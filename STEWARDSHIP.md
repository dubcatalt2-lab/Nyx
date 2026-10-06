# Nyx Owner Dashboard

The Owner Dashboard uses Firebase Authentication for account metadata and
Firestore for Nyx profiles, roles, subscriptions, activity, and audit events.
All privileged reads and mutations run through Firebase Admin on the Nyx
server. The browser never receives service-account credentials, passwords, or
stored authentication tokens.

## Required environment variables

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`
- `NYX_FOUNDER_PROFILE_ADMIN_UID`

`NYX_FOUNDER_PROFILE_ADMIN_UID` is the Firebase Authentication UID of the one
Owner account. The dashboard cannot demote, disable, or delete this account.

## Firestore collections

- `nyxUserAdministration`: role and subscription metadata
- `nyxUserProfiles`: public Nyx profile information
- `nyxUserActivity`: last-active and signed-in online timestamps
- `nyxAuditLog`: immutable server-written account and security activity
- `nyxUsernames`: atomic, server-written unique username claims

Firebase Authentication already prevents duplicate username-account emails.
The `nyxUsernames` registry also protects editable profile usernames with a
Firestore transaction, so simultaneous username changes cannot create a
duplicate.

Deploy the included rules to the same Firebase project:

```sh
firebase deploy --only firestore:rules
```

VPS deployment does not deploy Firestore rules automatically.

## Ad-free access

Open Nyx, sign in as the owner, then open **Owner Dashboard > Users > Ad-free keys**.

Choose a label and duration, then create a key. Leave Account ID empty for a redeemable code, or enter the account ID to assign access immediately. Copy the full key when it appears; it is shown only once. Users redeem a code from **Account menu > Ad-free access**. The owner can assign unused keys or revoke access in the same dashboard. Access does not grant premium models or staff permissions.

Advertising is disabled by default. `NYX_ADS_ENABLED=true` explicitly enables placements on an approved host; production is currently kept disabled. Existing premium/staff exemptions and ad-free grants still apply when advertising is enabled.

Regular accounts receive ads only on the homepage. Adkid retains its placements and popup policy across Nyx pages. Dismissing connection warnings does not stop background recovery; a fresh outage can show another warning after the previous one recovers.

Adcoins automatically pauses all Nyx placements and popup opportunities for three minutes after ten minutes of visible use. The timer is shared by tabs in the same browser and survives reloads. Hidden or suspended time does not count. This is a local ad-break timer, not a transferable currency or a premium entitlement. The homepage countdown is hidden when ads are already disabled for the site or account.
