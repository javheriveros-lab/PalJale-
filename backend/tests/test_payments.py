from types import SimpleNamespace
from unittest.mock import patch

import pytest
import stripe


@pytest.mark.asyncio
async def test_one_tap_charges_and_marks_order_paid(client, mock_db, auth_headers):
    order_id = "ord_test_1"
    await mock_db.orders.insert_one({
        "id": order_id,
        "user_id": "user_1",
        "stripe_customer_id": "cus_123",
        "total_mxn": 1150.0,
        "platform_fee_mxn": 50.0,
        "deposit_mxn": 100.0,
        "payment_status": "unpaid",
    })

    fake_intent = SimpleNamespace(id="pi_fake_123", status="succeeded")
    with patch("payments.stripe.PaymentIntent.create", return_value=fake_intent) as mock_create:
        resp = client.post(
            "/api/payments/one-tap",
            json={"order_id": order_id, "payment_method_id": "pm_123"},
            headers=auth_headers("user_1", "cliente@test.com", "cliente"),
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["payment_intent_id"] == "pi_fake_123"

    _, kwargs = mock_create.call_args
    assert kwargs["amount"] == 115000
    assert kwargs["idempotency_key"] == f"onetap-{order_id}"
    assert "application_fee_amount" not in kwargs

    order = await mock_db.orders.find_one({"id": order_id})
    assert order["payment_status"] == "paid"
    assert order["stripe_payment_intent_id"] == "pi_fake_123"


@pytest.mark.asyncio
async def test_deposit_release_calls_refund_and_is_not_repeatable(client, mock_db, auth_headers):
    order_id = "ord_test_2"
    await mock_db.orders.insert_one({
        "id": order_id,
        "provider_id": "provider_1",
        "user_id": "user_1",
        "stripe_payment_intent_id": "pi_charged_1",
        "deposit_mxn": 100.0,
        "deposit_status": "held",
    })

    fake_refund = SimpleNamespace(id="re_fake_1")
    headers = auth_headers("provider_1", "prov@test.com", "proveedor")

    with patch("payments.stripe.Refund.create", return_value=fake_refund) as mock_refund:
        resp = client.post(f"/api/payments/deposit/{order_id}/release", headers=headers)

    assert resp.status_code == 200, resp.text
    _, kwargs = mock_refund.call_args
    assert kwargs["payment_intent"] == "pi_charged_1"
    assert kwargs["amount"] == 10000
    assert kwargs["idempotency_key"] == f"deposit-release-{order_id}"

    order = await mock_db.orders.find_one({"id": order_id})
    assert order["deposit_status"] == "released"
    assert order["stripe_refund_id"] == "re_fake_1"

    # Segundo intento: el depósito ya no está "held", debe rechazarse sin volver a llamar a Stripe.
    resp2 = client.post(f"/api/payments/deposit/{order_id}/release", headers=headers)
    assert resp2.status_code == 400


@pytest.mark.asyncio
async def test_deposit_release_reverts_state_on_stripe_failure(client, mock_db, auth_headers):
    order_id = "ord_test_3"
    await mock_db.orders.insert_one({
        "id": order_id,
        "provider_id": "provider_1",
        "user_id": "user_1",
        "stripe_payment_intent_id": "pi_charged_2",
        "deposit_mxn": 50.0,
        "deposit_status": "held",
    })
    headers = auth_headers("provider_1", "prov@test.com", "proveedor")

    with patch("payments.stripe.Refund.create", side_effect=stripe.error.StripeError("fallo simulado")):
        resp = client.post(f"/api/payments/deposit/{order_id}/release", headers=headers)

    assert resp.status_code == 502
    order = await mock_db.orders.find_one({"id": order_id})
    assert order["deposit_status"] == "held"  # se revirtió, no queda atorado en "releasing"


def test_webhook_invalid_signature_rejected(client):
    with patch("payments.stripe.Webhook.construct_event", side_effect=stripe.error.SignatureVerificationError("bad sig", "sig")):
        resp = client.post(
            "/api/payments/webhook",
            data=b"{}",
            headers={"stripe-signature": "bad"},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_webhook_checkout_session_completed_marks_order_paid(client, mock_db):
    order_id = "ord_test_4"
    await mock_db.orders.insert_one({"id": order_id, "user_id": "user_1", "payment_status": "pending"})

    fake_event = {
        "type": "checkout.session.completed",
        "data": {"object": {
            "payment_intent": "pi_from_webhook",
            "metadata": {"type": "order_payment", "order_id": order_id},
        }},
    }
    with patch("payments.stripe.Webhook.construct_event", return_value=fake_event):
        resp = client.post(
            "/api/payments/webhook",
            data=b"{}",
            headers={"stripe-signature": "valid"},
        )

    assert resp.status_code == 200
    order = await mock_db.orders.find_one({"id": order_id})
    assert order["payment_status"] == "paid"
    assert order["stripe_payment_intent_id"] == "pi_from_webhook"
