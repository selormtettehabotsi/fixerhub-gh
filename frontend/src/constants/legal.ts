/**
 * LEGAL TEXT — Terms of Service and Privacy Policy.
 *
 * Kept as plain strings in the bundle rather than fetched, for two reasons:
 * someone reviewing what they agreed to shouldn't need a connection, and the
 * text a user accepted should be the text that shipped in that build.
 *
 * A very light markup is used and rendered by app/legal.tsx:
 *   "## "  heading
 *   "- "   bullet
 *   ""     blank line
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT: this is a working draft written to be accurate about what the app
 * actually does — not legal advice, and not reviewed by a lawyer. Before taking
 * real payments from the public, have a Ghanaian lawyer review both documents,
 * and register with the Data Protection Commission as a data controller, which
 * the Data Protection Act 2012 (Act 843) requires of anyone processing personal
 * data in Ghana.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const LEGAL_LAST_UPDATED = '4 August 2026';

export const TERMS = `
FixerHub connects customers who need home services with independent workers who
provide them. These terms explain what we do, what we don't, and what each side
is responsible for. Please read them before using the app.

Last updated: ${LEGAL_LAST_UPDATED}

## 1. Who we are

FixerHub is a marketplace operated by the FixerHub team in Ghana. We are not a
plumbing, electrical, carpentry or cleaning company. We do not employ the workers
listed in the app.

## 2. What FixerHub is, and what it isn't

- We introduce customers to independent workers and handle booking, messaging and payment.
- Workers are self-employed. They are not our employees, agents or partners.
- The contract for the work itself is between the customer and the worker. We are not a party to it.
- We do not supervise, direct or guarantee the work performed.

## 3. Accounts

- You must be at least 18 years old to create an account.
- Give accurate information and keep it up to date.
- You are responsible for what happens under your account. Keep your password to yourself.
- One person, one account. Don't create an account on someone else's behalf without their knowledge.
- We may suspend or close an account that breaks these terms, is used fraudulently, or puts other users at risk.

## 4. Worker verification (KYC)

- Workers must submit identity documents before their profile becomes visible to customers.
- An administrator reviews each submission. Until it is approved, the worker does not appear in search results.
- Verification means we checked that documents were provided and appear valid. It is not a background check, a skills assessment, a guarantee of quality, and not an endorsement.
- Submitting false or altered documents will get the account closed permanently.

## 5. Bookings, quotes and prices

- A customer sets a budget range. A worker may respond with a quote.
- The customer accepts or declines that quote before work begins.
- The final amount is confirmed by the worker when the job is marked complete, and that is the amount charged.
- Prices are in Ghana Cedis (GH₵) and include our commission.
- Scheduled bookings are a request for a time, not a guarantee the worker will arrive at that exact moment.

## 6. Payment

- Payments are processed by Paystack. We never see or store your full card details.
- Payment is due once the worker marks the job complete.
- We deduct a commission from the amount paid and pass the remainder to the worker.
- The current commission rate is shown in the app and may change with notice. Workers on a FixerHub Pro subscription pay a reduced rate.

## 7. Cancellations and refunds

- A customer may cancel a booking before the worker starts. Cancelling repeatedly or after a worker has travelled may affect your account.
- A worker may decline a booking. Frequent declines reduce visibility in search.
- Refunds are handled case by case. If something went wrong, report it in the app and an administrator will review it.
- Where a refund is approved, it goes back through Paystack to the original payment method.

## 8. FixerHub Pro (workers)

- Pro is a paid subscription that reduces commission and improves placement in nearby search.
- It runs for 30 days from purchase and does not renew automatically.
- Subscription payments are not refundable once the period has started.

## 9. Referrals

- Referral rewards apply when a referred user makes their first payment.
- Creating fake accounts to earn referrals will forfeit the rewards and may close the account.

## 10. Reviews

- Only customers who booked a job can review that worker.
- Write about the work. We remove reviews that contain abuse, personal information about others, or content unrelated to the job.
- We do not remove reviews just because a worker dislikes them.

## 11. Behaviour

Don't use FixerHub to:

- harass, threaten or discriminate against anyone
- arrange payment outside the app to avoid commission
- post someone else's personal information
- misrepresent your identity, skills or licences
- attempt to break, overload or reverse-engineer the service

## 12. Safety

- Meet in the location agreed in the booking.
- Tell someone where you'll be, especially for a first job with a new person.
- Report anything that felt unsafe through Report an Issue in the app.
- In an emergency, contact the police first, then tell us.

## 13. Our liability

- We provide the platform "as is" and do our best to keep it working, but we can't promise it will never be unavailable.
- We are not responsible for the quality, safety, legality or timeliness of work performed by a worker.
- We are not responsible for loss or damage caused by a worker, or by a customer, to the other.
- Nothing in these terms limits liability that cannot be limited under Ghanaian law.

## 14. Disputes

- Tell us first. Most problems are resolved fastest through Report an Issue.
- These terms are governed by the laws of Ghana, and the courts of Ghana have jurisdiction.

## 15. Changes

We may update these terms. If we change something significant, we'll tell you in
the app. Continuing to use FixerHub after a change means you accept the new terms.

## 16. Contact

Questions about these terms: support@fixerhub.me
`.trim();

export const PRIVACY = `
This policy explains what personal data FixerHub collects, why, who sees it, and
what you can do about it.

Last updated: ${LEGAL_LAST_UPDATED}

## What we collect

**When you sign up**
- Name, email address, phone number
- Password (stored hashed — we cannot read it)
- Whether you are a customer or a worker
- A referral code, if someone referred you

**If you are a worker**
- Your trade and base location
- Identity documents you upload for verification
- Price range and availability
- Payout details needed to send you money

**When you use the app**
- Location: customers' approximate location to find nearby workers; workers' live location only while a job is marked "on the way"
- Bookings, quotes, amounts and job descriptions
- Chat messages, photos and voice notes you send
- Reviews you write
- Payment references from Paystack (never card numbers)
- A device token, so we can send you notifications

## Why we collect it

- To run the service: match customers to workers, take bookings, deliver messages, process payments
- To verify workers, so customers know who they're letting into their home
- To show live tracking and estimated arrival times
- To calculate commission and pay workers
- To investigate reports of problems, fraud or unsafe behaviour
- To send notifications about your bookings

We do not sell your personal data, and we do not use it for advertising.

## Location, specifically

- Customers: used to sort workers by distance. You can decline the permission — you'll then need to search without distance sorting.
- Workers: your live position is shared with one customer, only while that booking is "on the way", and only for that period. It is relayed, not stored as a history.
- Worker profile locations are approximate on public profiles.

## Who else sees your data

- **Other users**, but only what's necessary: customers see a worker's name, photo, trade, rating and reviews. Phone numbers and identity documents are not shown on public profiles. Contact details become visible to the other party once a booking exists.
- **Paystack**, to process payments and payouts.
- **Google**, to turn an address into map coordinates.
- **Africa's Talking**, to send SMS one-time codes and job notifications.
- **Firebase (Google)**, to deliver push notifications.
- **Cloudinary**, to store photos, voice notes and documents.
- **Authorities**, where the law requires it, or to protect someone's safety.

## How long we keep it

- Account data: while your account exists, then deleted or anonymised
- Bookings and payments: kept after account closure where we must, for tax and accounting
- KYC documents: kept while the worker is active, and for a period after, to handle disputes
- Chat messages: kept so both sides have a record of what was agreed
- Live location: not retained after the trip ends

## Security

- Passwords are hashed, never stored in readable form
- Tokens are held in the device's secure keychain
- Traffic between the app and our servers is encrypted (HTTPS)
- Access to identity documents is limited to administrators reviewing them

No system is perfectly secure. If a breach affects you, we will tell you.

## Your rights

Under Ghana's Data Protection Act, 2012 (Act 843) you can:

- ask what data we hold about you
- have inaccurate data corrected
- ask us to delete your data, subject to records we must keep by law
- object to how we use it
- complain to the Data Protection Commission

You can delete your account from Profile at any time. Email support@fixerhub.me
for anything else.

## Children

FixerHub is not for anyone under 18. If we learn that an account belongs to a
child, we will close it and delete the data.

## Changes

If we change how we use your data, we'll tell you in the app before it takes
effect.

## Contact

support@fixerhub.me
`.trim();
