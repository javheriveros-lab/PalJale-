from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class BankConfigRequest(BaseModel):
    bank_name: str = Field(..., example="BBVA")
    account_holder: str = Field(..., example="Juan Pérez")
    card_number: str = Field(..., min_length=13, max_length=19, example="4111111111111111")

class BankConfigResponse(BaseModel):
    id: str
    bank_name: str
    account_holder: str
    card_number: str
    updated_by: str
    updated_at: datetime
    is_active: bool

class CommissionPayout(BaseModel):
    id: str
    order_id: str
    amount_mxn: float
    platform_fee_percent: float
    bank_config_snapshot: dict
    status: str
    stripe_transfer_id: Optional[str]
    processed_at: Optional[datetime]
    created_at: datetime

class ConnectAccountRequest(BaseModel):
    business_type: Optional[str] = "individual"
    country: str = "MX"

class ConnectAccountResponse(BaseModel):
    stripe_account_id: str
    account_link_url: str

class ConnectStatusResponse(BaseModel):
    stripe_account_id: Optional[str]
    status: Optional[str]
    charges_enabled: bool
    payouts_enabled: bool
    requirements_due: bool

class SetupIntentResponse(BaseModel):
    client_secret: str
    stripe_customer_id: str

class PaymentMethodCard(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool

class OneTapPaymentRequest(BaseModel):
    order_id: str
    payment_method_id: str

class InsuranceQuote(BaseModel):
    subtotal_mxn: float
    insurance_percent: float = 3.0
    insurance_fee_mxn: float

class ProSubscriptionStatus(BaseModel):
    is_pro: bool
    status: str
    current_period_end: Optional[int] = None
    cancel_at_period_end: bool = False
