# Gatherly - EmailJS Setup Guide & Email Templates

This guide contains the step-by-step setup instructions and ready-to-use HTML email templates for your **EmailJS** account.

---

## 🚀 Quick Setup Instructions (3 Steps)

### Step 1: Connect Your Gmail (Service ID)
1. Go to [dashboard.emailjs.com](https://dashboard.emailjs.com/) and sign in.
2. In the left sidebar, click **Email Services** &rarr; **Add New Service**.
3. Select **Gmail** (or Outlook/Yahoo).
4. Click **Connect Account** and authorize your Gmail account (`spandandasom40@gmail.com`).
5. Click **Create Service**.
6. Copy your **Service ID** (e.g., `service_gatherly` or `service_abc123`).

### Step 2: Get Your Public & Private Keys
1. In EmailJS Dashboard, click **Account** in the left sidebar.
2. Under the **General** tab, copy your **Public Key** (e.g., `user_xxxx` or random letters).
3. Under the **Security** tab, find **Private Key (API Key)**:
   - Check **"Allow EmailJS API for non-browser applications"**.
   - Copy your **Private Key**.

### Step 3: Create Templates in EmailJS
1. In the left sidebar, click **Email Templates** &rarr; **Create New Template**.
2. Paste the HTML template from below into the template content editor (switch to **Source Code / HTML** mode `<>`).
3. Set the top fields in EmailJS:
   - **To Email**: `{{to_email}}`
   - **From Name**: `Gatherly`
   - **Subject**: `{{subject}}`
   - **Reply To**: `{{to_email}}`
4. Click **Save** in the top right.
5. Copy the **Template ID** (e.g., `template_gatherly` or `template_xyz789`).

---

## 🔑 Render & `.env` Configuration

Add these to your **Render Dashboard** &rarr; **Environment** (and your local `.env`):

```env
# Required EmailJS Keys
EMAILJS_SERVICE_ID=service_your_service_id
EMAILJS_PUBLIC_KEY=your_public_key_here
EMAILJS_PRIVATE_KEY=your_private_key_here
EMAILJS_TEMPLATE_ID=template_universal_id

# Optional: Specific Template IDs (Gatherly automatically falls back to EMAILJS_TEMPLATE_ID if left empty)
EMAILJS_OTP_TEMPLATE_ID=
EMAILJS_TICKET_TEMPLATE_ID=
EMAILJS_INVITE_TEMPLATE_ID=
EMAILJS_UPDATE_TEMPLATE_ID=
```

---

## 📋 Email Templates (Ready to Copy & Paste)

### 🌟 TEMPLATE 1: Universal Master Template (Recommended - 1 Template For Everything)
> **Use this if you only want to set up ONE template in EmailJS.** It handles OTPs, event passes, invitations, cinema tickets, and updates automatically!
- **Template Name in EmailJS**: `Gatherly Universal`
- **Template ID**: Put this in `EMAILJS_TEMPLATE_ID`
- **Subject**: `{{subject}}`
- **To Email**: `{{to_email}}`
- **From Name**: `Gatherly`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="560" style="max-width: 560px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(184, 255, 101, 0.22); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 36px 20px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #b8ff65 0%, #86efac 100%); color: #0d1405; font-size: 22px; font-weight: 900; text-align: center;">✦</div>
              <h1 style="margin: 12px 0 0; font-size: 22px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">GATHERLY<span style="color: #b8ff65;">.</span></h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 750; color: #ffffff;">{{subject}}</h2>
              <p style="margin: 0 0 20px; font-size: 14px; color: #a1a1aa; line-height: 1.6;">Hello {{to_name}},</p>
              
              <!-- Message Box -->
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 15px; color: #e4e4e7; line-height: 1.7; white-space: pre-line;">{{message}}</p>
              </div>

              <!-- Action Button (Optional) -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 10px 0 20px;">
                <tr>
                  <td align="center" style="border-radius: 999px; background: #b8ff65;">
                    <a href="{{site_url}}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; color: #0d1405; text-decoration: none; border-radius: 999px;">OPEN GATHERLY</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; font-size: 12px; color: #71717a; line-height: 1.5;">If you did not request this email or need assistance, please ignore this message or contact Gatherly Support.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 28px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Events & Cinema. All rights reserved.</p>
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

### 🔢 TEMPLATE 2: Dedicated OTP Verification Template
- **Template Name in EmailJS**: `Gatherly OTP Code`
- **Template ID**: Put this in `EMAILJS_OTP_TEMPLATE_ID`
- **Subject**: `{{subject}}`
- **To Email**: `{{to_email}}`
- **From Name**: `Gatherly Security`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gatherly Verification Code</title>
</head>
<body style="margin: 0; padding: 30px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
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
              <p style="margin: 0; font-size: 12px; color: #71717a;">If you did not request this verification code, please ignore this message.</p>
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

### 🎟 TEMPLATE 3: Dedicated Event Pass & Ticket Confirmation
- **Template Name in EmailJS**: `Gatherly Event Pass`
- **Template ID**: Put this in `EMAILJS_TICKET_TEMPLATE_ID`
- **Subject**: `{{subject}}`
- **To Email**: `{{to_email}}`
- **From Name**: `Gatherly Tickets`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Gatherly Pass</title>
</head>
<body style="margin: 0; padding: 26px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="540" style="max-width: 540px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(184, 255, 101, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 18px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #b8ff65 0%, #86efac 100%); color: #0d1405; font-size: 22px; font-weight: 900; text-align: center;">✦</div>
              <h1 style="margin: 10px 0 0; font-size: 20px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">GATHERLY PASS</h1>
            </td>
          </tr>

          <!-- Pass Details -->
          <tr>
            <td style="padding: 30px 32px;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(184, 255, 101, 0.15); border: 1px solid rgba(184, 255, 101, 0.35); color: #b8ff65; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px;">BOOKING CONFIRMED</span>
              
              <h2 style="margin: 0 0 18px; font-size: 24px; font-weight: 850; color: #ffffff;">{{event_title}}</h2>
              
              <!-- Event Meta Card -->
              <table role="presentation" width="100%" style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; margin-bottom: 22px;" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="30%" style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Date & Time</td>
                  <td style="font-size: 14px; color: #ffffff; font-weight: 650;">{{event_date}} · {{event_time}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Venue</td>
                  <td style="font-size: 14px; color: #ffffff; font-weight: 650;">{{venue}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Quantity</td>
                  <td style="font-size: 14px; color: #b8ff65; font-weight: 750;">{{quantity}} Ticket(s)</td>
                </tr>
              </table>

              <p style="margin: 0 0 22px; font-size: 13.5px; color: #d4d4d8; line-height: 1.6;">Your digital QR pass is saved directly in your Gatherly account under <strong>My Event Passes</strong>. Please present it at the entry gate.</p>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 10px;">
                <tr>
                  <td align="center" style="border-radius: 999px; background: #b8ff65;">
                    <a href="{{action_url}}" target="_blank" style="display: inline-block; padding: 13px 32px; font-size: 13px; font-weight: 850; letter-spacing: 0.06em; color: #0d1405; text-decoration: none; border-radius: 999px;">VIEW MY PASSES IN APP</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Events. See you at the experience!</p>
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

### 🎬 TEMPLATE 4: Dedicated Cinema / Movie Ticket Template
- **Template Name in EmailJS**: `Gatherly Movie Ticket`
- **Template ID**: Put this in `EMAILJS_TICKET_TEMPLATE_ID`
- **Subject**: `{{subject}}`
- **To Email**: `{{to_email}}`
- **From Name**: `Gatherly Cinema`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Movie Ticket</title>
</head>
<body style="margin: 0; padding: 26px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="540" style="max-width: 540px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(192, 132, 252, 0.3); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 18px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #c084fc 0%, #a855f7 100%); color: #ffffff; font-size: 22px; font-weight: 900; text-align: center;">🎬</div>
              <h1 style="margin: 10px 0 0; font-size: 20px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">GATHERLY CINEMA</h1>
            </td>
          </tr>

          <!-- Cinema Details -->
          <tr>
            <td style="padding: 30px 32px;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(192, 132, 252, 0.15); border: 1px solid rgba(192, 132, 252, 0.4); color: #c084fc; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px;">SEATS CONFIRMED</span>
              
              <h2 style="margin: 0 0 18px; font-size: 24px; font-weight: 850; color: #ffffff;">{{film_title}}</h2>
              
              <!-- Show Meta Card -->
              <table role="presentation" width="100%" style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; margin-bottom: 22px;" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="30%" style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Theatre</td>
                  <td style="font-size: 14px; color: #ffffff; font-weight: 650;">{{theatre_name}} · {{screen_name}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Showtime</td>
                  <td style="font-size: 14px; color: #ffffff; font-weight: 650;">{{screening_date}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Seats</td>
                  <td style="font-size: 16px; color: #c084fc; font-weight: 850;">{{seats}}</td>
                </tr>
              </table>

              <p style="margin: 0 0 20px; font-size: 13.5px; color: #d4d4d8; line-height: 1.6;">Your seat reservation is confirmed. Head to <strong>Movie Tickets</strong> in Gatherly to view your QR admission pass anytime.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Cinema. Enjoy the show!</p>
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

### ✉ TEMPLATE 5: Private Event Invitation
- **Template Name in EmailJS**: `Gatherly Invitation`
- **Template ID**: Put this in `EMAILJS_INVITE_TEMPLATE_ID`
- **Subject**: `{{subject}}`
- **To Email**: `{{to_email}}`
- **From Name**: `Gatherly Invitations`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Invitation</title>
</head>
<body style="margin: 0; padding: 26px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="540" style="max-width: 540px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(184, 255, 101, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 18px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #b8ff65 0%, #86efac 100%); color: #0d1405; font-size: 22px; font-weight: 900; text-align: center;">✉</div>
              <h1 style="margin: 10px 0 0; font-size: 20px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">YOU'RE INVITED</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #a1a1aa;">You have been personally invited to join:</p>
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 850; color: #ffffff;">{{event_title}}</h2>
              
              <!-- Event Meta Card -->
              <table role="presentation" width="100%" style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px; margin-bottom: 24px; text-align: left;" cellspacing="0" cellpadding="6">
                <tr>
                  <td width="30%" style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">When</td>
                  <td style="font-size: 14px; color: #ffffff; font-weight: 650;">{{event_date}} · {{event_time}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 700;">Where</td>
                  <td style="font-size: 14px; color: #ffffff; font-weight: 650;">{{venue}}</td>
                </tr>
              </table>

              <!-- RSVP Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 10px;">
                <tr>
                  <td align="center" style="border-radius: 999px; background: #b8ff65;">
                    <a href="{{action_url}}" target="_blank" style="display: inline-block; padding: 13px 36px; font-size: 13px; font-weight: 850; letter-spacing: 0.06em; color: #0d1405; text-decoration: none; border-radius: 999px;">OPEN INVITATION & RSVP</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Events. All rights reserved.</p>
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

### 📢 TEMPLATE 6: Event Host Announcement & Update
- **Template Name in EmailJS**: `Gatherly Event Update`
- **Template ID**: Put this in `EMAILJS_UPDATE_TEMPLATE_ID`
- **Subject**: `{{subject}}`
- **To Email**: `{{to_email}}`
- **From Name**: `Gatherly Updates`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Update</title>
</head>
<body style="margin: 0; padding: 26px 0; background-color: #0b0f0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f0fdf4;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="540" style="max-width: 540px; width: 100%; margin: 0 auto; background: #121911; border: 1px solid rgba(184, 255, 101, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 18px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: linear-gradient(135deg, #b8ff65 0%, #86efac 100%); color: #0d1405; font-size: 22px; font-weight: 900; text-align: center;">📢</div>
              <h1 style="margin: 10px 0 0; font-size: 20px; font-weight: 850; letter-spacing: 0.12em; color: #f0fdf4;">EVENT ANNOUNCEMENT</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 32px;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(184, 255, 101, 0.15); border: 1px solid rgba(184, 255, 101, 0.35); color: #b8ff65; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px;">{{event_title}}</span>
              
              <h2 style="margin: 0 0 14px; font-size: 22px; font-weight: 850; color: #ffffff;">{{update_title}}</h2>
              
              <!-- Announcement Box -->
              <div style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin-bottom: 22px;">
                <p style="margin: 0; font-size: 14.5px; color: #e4e4e7; line-height: 1.7; white-space: pre-line;">{{update_message}}</p>
              </div>

              <p style="margin: 0; font-size: 12px; color: #71717a; line-height: 1.5;">This update is also pinned to the Event Updates tab inside your Gatherly account.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0, 0, 0, 0.25);">
              <p style="margin: 0; font-size: 11px; color: #71717a;">© {{year}} Gatherly Events. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
