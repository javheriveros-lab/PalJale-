from types import SimpleNamespace
from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_account_link_rejects_foreign_account(client, mock_db, auth_headers):
    await mock_db.users.insert_one({
        "id": "provider_1",
        "stripe_connect_account_id": "acct_own",
    })
    headers = auth_headers("provider_1", "prov@test.com", "proveedor")

    resp = client.post(
        "/api/connect/account-link",
        json={"stripe_account_id": "acct_someone_else"},
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_account_link_allows_own_account(client, mock_db, auth_headers):
    await mock_db.users.insert_one({
        "id": "provider_1",
        "stripe_connect_account_id": "acct_own",
    })
    headers = auth_headers("provider_1", "prov@test.com", "proveedor")

    fake_link = SimpleNamespace(url="https://connect.stripe.com/setup/fake")
    with patch("connect.stripe.AccountLink.create", return_value=fake_link):
        resp = client.post(
            "/api/connect/account-link",
            json={"stripe_account_id": "acct_own"},
            headers=headers,
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["stripe_account_id"] == "acct_own"
