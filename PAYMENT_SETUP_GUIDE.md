# Payment Gateway Setup Guide 💳

This guide will help you set up real payment gateways for your Khedmati platform. Currently, the system supports multiple payment methods popular in Jordan.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Setup](#database-setup)
3. [Credit Card Payments (PayTabs)](#credit-card-payments-paytabs)
4. [CliQ Payments](#cliq-payments)
5. [Orange Money](#orange-money)
6. [uWallet](#uwallet)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)

## Overview

The payment system is built with:
- **Multi-gateway support**: Credit cards, CliQ, Orange Money, uWallet
- **Secure processing**: All payments tracked in database
- **Flexible architecture**: Easy to add new payment methods
- **User-friendly**: Multi-step wizard for easy checkout

## Database Setup

### Step 1: Run the Migration

Run the migration file to add payment support:

```sql
-- Run this in your Supabase SQL editor
\i migrations/25_add_wallet_payments.sql
```

This will:
- Update the `payments` table to support top-ups
- Add support for wallet payment methods
- Create `wallet_transactions` table
- Add RPC functions for payment processing

### Step 2: Verify Tables

Check that these tables exist:
- `payments` - All payment records
- `wallet_transactions` - Wallet-specific transaction data
- `credits_ledger` - Credit balance tracking

## Credit Card Payments (PayTabs)

PayTabs (ClickPay) is one of the most popular payment gateways in Jordan.

### Registration

1. Go to [PayTabs Jordan](https://www.paytabs.com/en/jordan/)
2. Create a merchant account
3. Complete KYC verification
4. Get your credentials from the dashboard

### Configuration

Update `payment-gateway.js` with your credentials:

```javascript
paytabs: {
    enabled: true,
    profileId: 'YOUR_PROFILE_ID',        // From PayTabs dashboard
    serverKey: 'YOUR_SERVER_KEY',         // Server Key
    clientKey: 'YOUR_CLIENT_KEY',         // Client Key  
    endpoint: 'https://secure.paytabs.com/payment/request'
}
```

### Backend Integration

You'll need to create a backend endpoint to securely initiate payments:

```javascript
// Example Node.js/Express endpoint
app.post('/api/create-paytabs-payment', async (req, res) => {
    const { amount, packageName, userEmail } = req.body;
    
    const paymentData = {
        profile_id: process.env.PAYTABS_PROFILE_ID,
        tran_type: "sale",
        tran_class: "ecom",
        cart_id: `topup_${Date.now()}`,
        cart_currency: "JOD",
        cart_amount: amount,
        cart_description: `Khedmati Credits: ${packageName}`,
        callback: `${process.env.BASE_URL}/api/paytabs-callback`,
        return: `${process.env.BASE_URL}/dashboard.html?payment=success`,
        customer_details: {
            name: "Customer",
            email: userEmail,
            phone: "962700000000"
        }
    };
    
    // Call PayTabs API
    const response = await fetch('https://secure.paytabs.com/payment/request', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': process.env.PAYTABS_SERVER_KEY
        },
        body: JSON.stringify(paymentData)
    });
    
    const result = await response.json();
    res.json({ paymentUrl: result.redirect_url });
});
```

### Callback Handler

Create a callback endpoint to handle payment confirmations:

```javascript
app.post('/api/paytabs-callback', async (req, res) => {
    const { tran_ref, cart_id, respStatus } = req.body;
    
    if (respStatus === 'A') { // Payment approved
        // Call Supabase to confirm payment
        await supabase.rpc('confirm_topup_payment', {
            p_payment_id: cart_id,
            p_transaction_ref: tran_ref,
            p_credits_amount: creditsAmount,
            p_package_name: packageName
        });
    }
    
    res.send('OK');
});
```

## CliQ Payments

CliQ is Jordan's instant payment system operated by JoPACC.

### How CliQ Works

1. User enters their mobile number (registered with their bank)
2. System sends payment request through CliQ
3. User receives notification on banking app
4. User approves payment
5. Instant settlement

### Integration Options

#### Option 1: Through Your Bank

Contact your business bank in Jordan (Arab Bank, Housing Bank, etc.) to:
1. Open a merchant account
2. Request CliQ merchant integration
3. Get API credentials

#### Option 2: Through Payment Aggregator

Use a payment aggregator that supports CliQ:
- **Madfoo3ati**: [https://madfooati.com](https://madfooati.com)
- **Aman**: [https://www.jordan.gov.jo/wps/portal/Home/GovernmentEntities/Ministries/Ministry/Ministry%20of%20Digital%20Economy%20and%20Entrepreneurship/MODEE5](https://www.jordan.gov.jo/wps/portal/Home/GovernmentEntities/Ministries/Ministry/Ministry%20of%20Digital%20Economy%20and%20Entrepreneurship/MODEE5)

### Example Integration

```javascript
// Example CliQ payment initiation
async function initiateCliqPayment(mobileNumber, amount, reference) {
    const response = await fetch('YOUR_BANK_CLIQ_API/initiate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CLIQ_API_KEY}`
        },
        body: JSON.stringify({
            alias: mobileNumber,          // Customer's mobile (CliQ alias)
            amount: amount,
            currency: 'JOD',
            reference: reference,
            merchantId: YOUR_MERCHANT_ID
        })
    });
    
    return await response.json();
}
```

## Orange Money

Orange Money is a mobile wallet service by Orange Jordan.

### Registration

1. Contact Orange Jordan Business Solutions: [https://www.orange.jo/en/business](https://www.orange.jo/en/business)
2. Request merchant integration
3. Sign merchant agreement
4. Get API credentials

### API Documentation

Request the Orange Money API documentation from Orange Jordan. Typical flow:

1. **Initiate Payment**
```javascript
POST https://api.orange.jo/omcoreapis/1.0.0/mp/pay
Headers:
  - Authorization: Bearer {access_token}
  - X-API-Key: {your_api_key}

Body:
{
  "amount": "20.00",
  "currency": "JOD",
  "merchantCode": "YOUR_MERCHANT_CODE",
  "customerMSISDN": "079XXXXXXX",
  "reference": "topup_12345"
}
```

2. **Verify Payment**
```javascript
GET https://api.orange.jo/omcoreapis/1.0.0/mp/transaction/{reference}
```

### Configuration

Update `payment-gateway.js`:

```javascript
orangeMoney: {
    enabled: true,
    apiKey: 'YOUR_ORANGE_API_KEY',
    merchantCode: 'YOUR_MERCHANT_CODE',
    endpoint: 'https://api.orange.jo/omcoreapis/1.0.0/mp/pay',
    // Get these from Orange Jordan
}
```

## uWallet

uWallet is a digital wallet platform in Jordan.

### Setup

1. Visit [uWallet](https://uwallet.jo) (or contact if they have a business program)
2. Complete merchant registration
3. Get API credentials

### Integration

```javascript
// Example uWallet payment
async function initiateUWalletPayment(walletId, amount) {
    const response = await fetch('https://api.uwallet.jo/v1/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Merchant-ID': UWALLET_MERCHANT_ID,
            'X-API-Key': UWALLET_API_KEY
        },
        body: JSON.stringify({
            wallet_id: walletId,
            amount: amount,
            currency: 'JOD',
            reference: `topup_${Date.now()}`
        })
    });
    
    return await response.json();
}
```

## Testing

### Current Demo Mode

The system currently runs in **demo mode** which simulates successful payments. This allows you to test the UI flow without real payment processing.

### Testing Steps

1. Open the provider dashboard
2. Click "شحن الرصيد" (Top Up)
3. Select a package
4. Choose a payment method
5. Fill in test details:
   - **CliQ**: Any 10-digit number starting with 0
   - **Orange Money**: 078XXXXXXX or 079XXXXXXX
   - **uWallet**: Any account ID
   - **Credit Card**: Will simulate payment page

6. Confirm payment
7. Wait for simulated processing (2-5 seconds)
8. Credits will be added to your account

### Enable Real Payments

To switch to real payments:

1. Update `payment-gateway.js` with real credentials
2. Remove the `simulatePaymentSuccess()` calls
3. Implement actual API calls to payment gateways
4. Set up webhook/callback handlers for payment confirmations

## Production Deployment

### Security Checklist

- [ ] Never expose API keys in frontend code
- [ ] Use environment variables for credentials
- [ ] Implement backend API for payment initiation
- [ ] Set up proper webhook handlers
- [ ] Enable HTTPS/SSL
- [ ] Implement request signing/verification
- [ ] Add rate limiting
- [ ] Log all transactions
- [ ] Set up monitoring and alerts

### Backend Architecture

```
User Browser          Your Backend         Payment Gateway
     |                      |                      |
     |-- Select Package --->|                      |
     |                      |                      |
     |<--- Show UI ---------|                      |
     |                      |                      |
     |-- Confirm Payment -->|                      |
     |                      |-- Init Payment ----->|
     |                      |<-- Payment URL ------|
     |                      |                      |
     |<--- Redirect --------|                      |
     |------------------- User Pays -------------->|
     |                      |                      |
     |                      |<---- Callback -------|
     |                      |                      |
     |                      |-- Confirm in DB ---->|
     |                      |                      |
     |<--- Success ---------|                      |
```

### Environment Variables

Create a `.env` file (never commit to git):

```env
# PayTabs
PAYTABS_PROFILE_ID=your_profile_id
PAYTABS_SERVER_KEY=your_server_key
PAYTABS_CLIENT_KEY=your_client_key

# CliQ
CLIQ_MERCHANT_ID=your_merchant_id
CLIQ_API_KEY=your_api_key
CLIQ_API_ENDPOINT=https://your-bank-api.com

# Orange Money
ORANGE_MONEY_API_KEY=your_api_key
ORANGE_MERCHANT_CODE=your_merchant_code

# uWallet
UWALLET_MERCHANT_ID=your_merchant_id
UWALLET_API_KEY=your_api_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### Webhook Security

Verify webhook signatures:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
    const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return hash === signature;
}

app.post('/webhook/payment', (req, res) => {
    const signature = req.headers['x-signature'];
    
    if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
        return res.status(401).send('Invalid signature');
    }
    
    // Process payment confirmation
    // ...
});
```

## Support

For payment gateway support:

- **PayTabs**: support@paytabs.com
- **CliQ**: Contact your bank's business department
- **Orange Money**: business@orange.jo
- **uWallet**: Check their website for contact info

## Next Steps

1. ✅ Run database migration
2. ✅ Test demo payment flow
3. 📋 Choose payment providers based on your needs
4. 📝 Register merchant accounts
5. 🔧 Implement backend endpoints
6. 🧪 Test with real payments in sandbox
7. 🚀 Deploy to production

---

**Note**: This platform is currently in demo mode. All payments are simulated. Follow this guide to integrate real payment gateways.
