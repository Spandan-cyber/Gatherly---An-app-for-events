# Gatherly - EmailJS 2-Template Setup Guide

EmailJS Free Tier provides **2 templates**. We have designed and condensed **100% of Gatherly's emails** into exactly **2 beautiful, neon-accented dark theme templates**:

| Template | Purpose | Environment Variable |
| :--- | :--- | :--- |
| **Template 1** | **OTP Verification & Security** (Signups, Logins, Password Resets, Deletion) | `EMAILJS_OTP_TEMPLATE_ID` |
| **Template 2** | **Passes, Cinema Tickets, Invitations & Updates** (All events, movies & announcements) | `EMAILJS_TEMPLATE_ID` |

---

## 🚀 Quick Setup Instructions (3 Steps)

### Step 1: Connect Your Gmail (Service ID)
1. Go to [dashboard.emailjs.com](https://dashboard.emailjs.com/) and sign in.
2. In the left sidebar, click **Email Services** &rarr; **Add New Service**.
3. Select **Gmail** (or Outlook/Yahoo).
4. Click **Connect Account** and sign in with your Gmail account (`spandandasom40@gmail.com`).
5. Click **Create Service**.
6. Copy your **Service ID** (e.g., `service_gatherly`).

### Step 2: Get Your Public & Private Keys
1. In EmailJS Dashboard, click **Account** in the bottom-left sidebar.
2. Under the **General** tab, copy your **Public Key**.
3. Under the **Security** tab, find **Private Key (API Key)**:
   - Check the box **"Allow EmailJS API for non-browser applications"**.
   - Copy your **Private Key**.

### Step 3: Create The 2 Templates in EmailJS
1. In EmailJS, go to **Email Templates** &rarr; **Create New Template**.
2. Create **Template 1** (paste the HTML from below) &rarr; Copy its Template ID.
3. Create **Template 2** (paste the HTML from below) &rarr; Copy its Template ID.

---

## 🔑 Environment Variables for Render & `.env`

Add these in **Render Dashboard** &rarr; **gatherly** web service &rarr; **Environment**:

```env
EMAILJS_SERVICE_ID=service_your_service_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
EMAILJS_OTP_TEMPLATE_ID=template_otp_id
EMAILJS_TEMPLATE_ID=template_activity_id
```

---

## 📋 The 2 Email Templates (Ready to Copy & Paste)

---

### 🔢 TEMPLATE 1: OTP Verification & Security
> **EmailJS Settings for Template 1:**
> - **Template Name**: `Gatherly OTP Verification`
> - **Subject**: `{{subject}}`
> - **To Email**: `{{to_email}}`
> - **From Name**: `Gatherly Security`
> - **Copy the Template ID into**: `EMAILJS_OTP_TEMPLATE_ID`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gatherly Verification Code</title>
</head>
<body style="margin: 0; padding: 28px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="520" style="max-width: 520px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(184, 255, 101, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #b8ff65 0%, #86efac 100%); color: #0d1405; font-size: 22px; font-weight: 900; text-align: center;">✦</div>
              <h1 style="margin: 12px 0 0; font-size: 20px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">GATHERLY<span style="color: #b8ff65;">.</span></h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 36px; text-align: center;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(184, 255, 101, 0.12); border: 1px solid rgba(184, 255, 101, 0.3); color: #b8ff65; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 14px;">SECURITY VERIFICATION</span>
              <h2 style="margin: 0 0 10px; font-size: 22px; font-weight: 800; color: #ffffff;">{{purpose}}</h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #a1a1aa; line-height: 1.5;">Enter the 6-digit verification code below to complete your action:</p>
              
              <!-- OTP Box -->
              <div style="background: rgba(184, 255, 101, 0.06); border: 2px dashed rgba(184, 255, 101, 0.45); border-radius: 16px; padding: 22px 20px; margin: 0 auto 24px; max-width: 300px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #b8ff65; display: block;">{{otp_code}}</span>
              </div>

              <p style="margin: 0 0 16px; font-size: 13px; color: #a1a1aa;">This code expires in <strong>{{expiry_minutes}} minutes</strong>. Never share this code with anyone.</p>
              <p style="margin: 0; font-size: 12px; color: #71717a;">If you did not request this verification code, please ignore this email.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Security. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

### 🎟 TEMPLATE 2: Passes, Cinema Tickets, Invitations & Updates
> **EmailJS Settings for Template 2:**
> - **Template Name**: `Gatherly Passes & Activity`
> - **Subject**: `{{subject}}`
> - **To Email**: `{{to_email}}`
> - **From Name**: `Gatherly`
> - **Copy the Template ID into**: `EMAILJS_TEMPLATE_ID`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 26px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="550" style="max-width: 550px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(184, 255, 101, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 18px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #b8ff65 0%, #86efac 100%); color: #0d1405; font-size: 22px; font-weight: 900; text-align: center;">✦</div>
              <h1 style="margin: 10px 0 0; font-size: 20px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">GATHERLY<span style="color: #b8ff65;">.</span></h1>
            </td>
          </tr>

          <!-- Dynamic Badge & Subject -->
          <tr>
            <td style="padding: 30px 34px 10px;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(184, 255, 101, 0.15); border: 1px solid rgba(184, 255, 101, 0.35); color: #b8ff65; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px;">{{badge_text}}</span>
              <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 850; color: #ffffff;">{{subject}}</h2>
              <p style="margin: 0 0 20px; font-size: 14px; color: #a1a1aa; line-height: 1.5;">Hello {{to_name}},</p>
            </td>
          </tr>

          <!-- Content Details Box -->
          <tr>
            <td style="padding: 0 34px 24px;">
              <div style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 22px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14.5px; color: #e4e4e7; line-height: 1.7; white-space: pre-line;">{{message}}</p>
              </div>

              <!-- Dynamic Action CTA Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 10px;">
                <tr>
                  <td align="center" style="border-radius: 999px; background: #b8ff65;">
                    <a href="{{action_url}}" target="_blank" style="display: inline-block; padding: 13px 34px; font-size: 13px; font-weight: 850; letter-spacing: 0.06em; color: #0d1405; text-decoration: none; border-radius: 999px;">{{action_btn_text}}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 34px 26px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Events & Cinema. See you at the experience!</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
