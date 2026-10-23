# ABDM / ABHA integration for a medication adherence app (as of October 2026)

> Research cut-off: 22 October 2026. Most recent official figures found are dated **10 July 2026**. Several figures circulating for Sept/Oct 2026 are from non-official sources and are flagged below.

---

## Q1. ABDM adoption as of 2026 — real activity or dormant registrations?

### Takeaway
ABHA account creation is enormous (~94 crore, i.e. roughly two-thirds of India's population) but is a near-worthless signal of usage: only ~1.1 health records exist per ABHA account, barely half of registered facilities run ABDM-enabled software, and the one peer-reviewed field study found only ~24% of OPD visits produced an ABHA registration at hospitals that were actively pushing it. The network is genuinely *live* — it is not vapourware — but it is thin, public-sector-skewed, and the "crore" numbers are registration theatre.

### Cited Findings
- As of **10 July 2026** (3rd Mission Steering Group meeting, chaired by Union Health Minister J.P. Nadda): **93.95+ crore ABHA numbers**, **105+ crore digital health records linked**, **5.33 lakh health facilities** in the registry, **9.85 lakh healthcare professionals** enrolled, **2.72 lakh facilities using ABDM-enabled software**, and **~24 crore Scan & Register tokens** generated — [Srishti IAS summary of the MSG review](https://srishtiias.com/ayushman-bharat-digital-mission-abdm-abha-health-id-2026/) (secondary source; it attributes the figures to the MSG review but does not cite the PIB release directly)
- Earlier 2026 checkpoints: **86 crore ABHA accounts as of February 2026** and 36,000+ AB-PMJAY empanelled hospitals — [Eka Care, 20 May 2026](https://www.eka.care/services/abdm-adoption-in-2026-what-hospitals-must-know) (vendor blog); a PIB release in **May 2026** reported **90 crore+ ABHA accounts**, and [IndiaMedToday](https://indiamedtoday.com/ayushman-bharat-digital-mission-crosses-90-crore-abha-accounts-milestone/) covered the 90-crore milestone
- Conflicting later figure: an SSRN working paper reports **~97.54 crore ABHA accounts by September 2026** and that linkage in national health programmes such as RCH and Sickle Cell is approximately **0.3%** — [SSRN: India's Digital Health Revolution: ABDM Policy and Implementation Gaps](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7466598). I could not verify the 97.54 crore figure against an official source; treat the 0.3% programme-linkage number as indicative, not confirmed.
- A separate July 2026 academic commentary cites **880+ million accounts as of May 2026** — [HMPI, 9 July 2026](https://hmpi.org/2026/07/09/from-infrastructure-to-impact-operationalizing-indias-ayushman-bharat-digital-mission/) (I could not extract the body text; the PDF stream did not decode, so only the headline figure from the search index is reported here)
- **Peer-reviewed field evidence on actual use:** a cross-sectional study at three government tertiary hospitals in Agra, UP (data collected Sept 2024 – Apr 2025) found hospital records showing **129,007 ABHA registrations against 537,278 OPD visits — a 23.96% adoption rate**, with monthly rates ranging 19.24%–32.68%. **Conventional paper-based registration remained the preferred route.** — [PMC13078079](https://pmc.ncbi.nlm.nih.gov/articles/PMC13078079/)
- Same study, barriers among *already-registered* patients: preference for in-person healthcare 85.6%, high data costs 81.9%, difficulty using health apps 65.6%, language difficulty 64.0%, **hesitancy to share OTPs 60.0%**, privacy/security concerns 49.6%, relies on others for digital tasks 48.5%; smartphone ownership 71.1%; **88% said they needed training or support** — [PMC13078079](https://pmc.ncbi.nlm.nih.gov/articles/PMC13078079/)
- The same study's abstract says 58.6% *lacked* adequate ABDM knowledge while its Results section says 58.6% *had* knowledge — an internal contradiction in the paper; do not rely on either figure — [PMC13078079](https://pmc.ncbi.nlm.nih.gov/articles/PMC13078079/)
- Earlier commentary on the registration-vs-use gap: at IAMAI's 2023 Digital Health Summit, NHA's Vikram Pagaria cited ~40 crore ABHA IDs, while another panellist argued there is "no point having these ABHAs ... unless and until it translates to getting that information on a health locker" — [MediaNama, Aug 2023](https://www.medianama.com/2023/08/223-iamai-digital-health-summit-ayushman-bharat-digital-health-mission/)
- Privacy track record: MediaNama reported in Dec 2024 that the PMJAY dashboard allowed anyone to find patients availing treatment, without login credentials, in apparent violation of the Health Data Management Policy — [MediaNama, Dec 2024](https://www.medianama.com/2024/12/223-abdm-privacy-by-design-dashboard-exposes-patient-details/). An earlier piece argued the government pushed health-ID creation (including mandating medical colleges register patients via health IDs) without matching effort on data safety — [MediaNama, Sept 2024](https://www.medianama.com/2024/09/223-error-404-privacy-not-found-in-ayushman-bharat-digital-mission-pmjay-dashboard/)
- Reported coercion into enrolment has been a recurring criticism of the mission — [MediaNama](https://www.medianama.com/2024/09/223-error-404-privacy-not-found-in-ayushman-bharat-digital-mission-pmjay-dashboard/)

### Inferences
- **105 crore records / 94 crore accounts ≈ 1.1 records per ABHA.** Since one hospital visit can generate several records, the realistic picture is that a large majority of ABHA holders have **zero or one** linked record. For a medication app, this means the expected yield from a consent-based fetch for a random Indian user is close to nothing.
- 2.72 lakh of 5.33 lakh registered facilities (~51%) run ABDM-enabled software, and registry *registration* ≠ record *publication*. The supply side of the network — the HIPs that would hold a prescription you want to fetch — is the real bottleneck, and the share of facilities actually publishing prescription bundles is almost certainly far below 51%.
- The largest single contributor to the "records linked" number is likely Scan & Share / Scan & Register (24 crore tokens), which creates an OPD token, not a clinical document. Token counts inflate the apparent liveness of the network.
- 60% OTP-sharing hesitancy is directly relevant: the ABHA login flow a medication app would use is OTP-based, so a meaningful fraction of users will abandon at that step.

### Gaps
- **No authoritative breakdown of what the "105 crore linked records" actually are** (Scan & Share tokens vs OP consultation bundles vs prescriptions vs discharge summaries). The ABDM dashboard at dashboard.abdm.gov.in is a JS app and returned no extractable figures to WebFetch; this is the single most important missing number for this decision.
- No public figure for **consent requests raised / granted per month** across the HIE-CM, which would be the direct measure of whether the exchange layer is used at all.
- No figure for how many of the 2.72 lakh ABDM-enabled facilities publish **prescription** records specifically.
- Could not reach PIB directly (pib.gov.in returned HTTP 403 to automated fetches), so official 2026 press releases are cited here via secondary reporting.

---

## Q2. ABDM building blocks and which matter to a medication app

### Takeaway
Only three of the blocks matter to a medication tracker: **ABHA (identity)**, **HIE-CM in the HIU direction (fetching prescriptions)**, and — the genuinely useful and overlooked one — the **National Drug Registry**, which is a free, open-API, SNOMED-coded medicine database that solves medicine-name autocomplete with no empanelment required. HPR and HFR are provider-side and irrelevant unless the app ever registers clinics.

### Cited Findings
- **ABHA Number / ABHA Address:** the identity layer. M1 covers creating an ABHA via Aadhaar or mobile OTP, verifying an existing ABHA with the two-step V3 login, serving the ABHA card and QR, and Scan & Share — [Nirmitee, ABDM milestones guide 2026](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- **HPR (Healthcare Professional Registry) and HFR (Health Facility Registry):** provider-side registries. Every facility using an integrated software must have its own HFR registration, and the HFR ID doubles as the HIP ID — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/); [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- **HIE-CM:** the ABDM Gateway itself acts as the Consent Manager — [Eka Developer Platform, ABDM docs](https://developer.eka.care/integrations/interoperability/abdm)
- **UHI (Unified Health Interface)** was launched **29 June 2026** by Union Health Minister J.P. Nadda as an interoperable service/discovery network — the service layer of ABDM, maintained by NHA, with participation restricted to doctors and facilities credentialed through HPR and HFR — [PIB, 29 June 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278987&reg=48&lang=1) (via [VisionIAS summary](https://visionias.in/current-affairs/news-today/2026-06-30/society/unified-health-interface-uhi-launched-along-with-other-digital-health-initiatives)). Four citizen services are reported operational, mainly clinic discovery and connection — [Omnicuris](https://www.omnicuris.com/medshots/editorial_picks/unified-health-interface-india-digital-healthcare-revolution). **Pharmacy discovery (private and government outlets), lab diagnostics discovery, and vaccination slot booking are listed as upcoming, not live.**
- **National Drug Registry** was launched under ABDM by the Union Health Minister as a "single source of truth for medicines in India", developed with CDSCO and NRCeS Pune. It holds **more than 123,000 branded medicines, over 10,000 generic drugs, and nearly 29,000 drug substances**, coded with **SNOMED CT**, searchable by generic name, brand name, active substance and manufacturer, and **offers open APIs** for providers, software platforms and digital services — [Digital Health News](https://www.digitalhealthnews.com/india-launches-national-drug-registry-under-abdm-bringing-standardized-medicine-information-nationwide) (page updated 02 Jul 2026); [PIB PRID 2278991](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278991&reg=48&lang=2) (403 to automated fetch; cited via search index, which reports the production portal as **drugregistry.abdm.gov.in** and a sandbox at **drugregistrysbx.abdm.gov.in/dr/v3**)
- NHA ran a public consultation on the Drug Registry; Practo's submitted recommendations are published on the ABDM site — [Practo recommendations, NHA Drug Registry](https://abdm.gov.in/strapicms/uploads/Practo_Recommendations_NHA_Drug_Registry_1a52739a6a.pdf)
- **NHCX** (health claims exchange) is a separate track, sometimes mislabelled "M4"; it requires ABDM M1 in production first — [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/). Irrelevant to a medication tracker.

### Inferences
- The Drug Registry is the **highest-value, lowest-cost** piece of ABDM for a medication app by a wide margin: it is a reference-data lookup, not a patient-data exchange, so it plausibly sits entirely outside the HIE-CM empanelment/audit regime. It would give brand-name autocomplete across ~123k Indian brands with SNOMED codes — exactly the hardest data problem in an Indian medication tracker, and one with no good free alternative.
- UHI's pharmacy-discovery phase, if it ships, would be the natural hook for a "refill" feature. It is not available now, and its launch dates are unannounced.
- There is a **naming conflict in the ecosystem** about "M4": Nirmitee says M4 is not an ABDM milestone and refers to NHCX, while Eka's developer docs call M4 "doctor and facility registration" (HPR/HFR SDK). Treat milestone numbering above M3 as vendor-specific.

### Gaps
- **The Drug Registry's actual API documentation, authentication model, rate limits and terms of use could not be retrieved.** drugregistry.abdm.gov.in is a JS app that returned only its title. "Open APIs" is a government press claim, not a verified open endpoint; whether it needs sandbox credentials is unresolved and is the top item to verify by hand.
- No confirmation of whether the Drug Registry includes **strengths, dosage forms, pack sizes or pricing** — only that it is searchable by generic/brand/substance/manufacturer. Without strength and form, autocomplete value drops substantially.
- No source found on Drug Registry data licensing (whether bulk download / caching is permitted).

---

## Q3. Technical path for a third-party app: sandbox, HIP vs HIU, certification

### Takeaway
A medication tracker is an **HIU** (it consumes records) and, under ABDM's taxonomy, specifically a **PHR app** — a patient-facing category that typically acts as both HIP and HIU. The path is sandbox registration → build M1 + M3 → NHA functional testing by an empanelled agency → CERT-In-empanelled security audit (WASA) → NHA committee review → production keys. The security audit and the empanelled-agency functional test are the hard gates: both are paid, third-party, calendar-bound, and cannot be self-certified.

### Cited Findings
- **Sandbox registration:** register at **sandbox.abdm.gov.in** as the entity that owns the software (the vendor, not each hospital); you receive a sandbox client ID and secret scoped to the roles you declare, e.g. HIP or HIU. **Approval is not instant** — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/). Sandbox gateway endpoints are on **dev.abdm.gov.in** — [Nirmitee integration guide](https://nirmitee.io/blog/step-by-step-guide-for-abdm-integration/)
- **Role definitions:** hospitals, labs, clinics and pharmacies are HIPs; insurers, referral systems and wellness platforms are HIUs; "integrated platforms can be HIP, HIU and PHR at once". **A PHR app is a separate ABDM track, patient-facing, typically acting as both HIP (storing records the patient uploads) and HIU (fetching records from other providers for the patient)** — [Eka Developer Platform, ABDM docs](https://developer.eka.care/integrations/interoperability/abdm)
- **Milestones:**
  - **M1 (identity, neither HIP nor HIU):** create ABHA via Aadhaar/mobile OTP, verify existing ABHAs with the two-step V3 login, ABHA card and QR, Scan & Share, HFR ID as HIP ID
  - **M2 (HIP):** link care contexts, answer discovery and link callbacks, store consents, send Fidelius-encrypted FHIR R4 bundles conforming to NRCeS profiles to a public HTTPS bridge URL
  - **M3 (HIU):** raise consent requests, act on consent notifications, fetch and decrypt records from other HIPs, and **purge data and keys when consent is revoked or expires**
  — [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- **M1 alone is not enough to exit the sandbox.** NHA Integration Support is quoted as saying exit criteria "require any 2 milestones to be completed to exit sandbox" — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/) and [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/). One of these pages notes the author could not independently confirm the two-milestone rule with NHA, so verify it. Most hospital systems complete M1 + M2.
- **Certification sequence (none skippable):** (1) **functional testing by an NHA-empanelled agency** — self-certification is not allowed; the page names FIME India, Suma Soft and Tata Communications from NHA's August 2022 empanelment and advises confirming the current list with your NHA SPOC; (2) **WASA security audit by a CERT-In empanelled auditor**, producing a final WASA report, a **Vulnerability Closure Certificate** and a **Safe-to-Host certificate**; (3) **NHA document submission and committee review** (test report, audit report, Safe-to-Host certificate, production keys template, application summary); (4) **production credentials and go-live**, then HFR registration per facility — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **Timelines:** no fixed durations published. Depends on agency calendars and fix-and-retest cycles; agency slots fill up near quarter-ends. In the author's experience production keys arrived within days of final committee approval, with ABDM-website listing ~3 weeks later — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **Costs:** the integrator pays for functional testing; adding features after a WASA audit may require repeating part of the audit at extra cost. **No rupee figures are published** — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **Architectural gotcha:** "the gateway calls *you* as much as you call it" — i.e. the integration requires a **publicly reachable HTTPS callback endpoint**, which developers routinely do not anticipate; and in V3, the request ID in the body of an `on-*` callback must match the header, described as the first thing sandbox support asks about — [sources summarised in search of ABDM developer guides](https://www.adrine.in/blog/abdm-integration-guide); [Nirmitee integration guide](https://nirmitee.io/blog/step-by-step-guide-for-abdm-integration/)
- **HIU flow concretely:** request consent → wait for decision callback → fetch the consent artefact → request data → decrypt FHIR bundles that arrive at your data-push URL — [docs.coronasafe.network, ABDM sandbox integration and exit](https://docs.coronasafe.network/abdm-documentation/implementers-guide/abdm-sandbox-integration-and-exit-process)
- **V3 ABHA login is two-step:** `/v3/profile/login/verify` returns a T-token and the account list; `/v3/profile/login/verify/user` returns the X-token required by profile, card and QR calls. Sensitive fields are RSA-OAEP encrypted — [h-wardhan/abdm-gateway (open-source Flask middleware for ABDM v3 M1)](https://github.com/h-wardhan/abdm-gateway)
- **Documentation is scattered:** official sandbox material, a community-maintained docs site, a repo "under development", and PDFs on Scribd all circulate at different versions — [kiranma72/abdm-docs](https://github.com/kiranma72/abdm-docs); [community ABDM sandbox docs](https://kiranma72.github.io/abdm-docs/)

### Inferences
- A medication tracker is unambiguously **HIU + PHR app**, not HIP — unless it wants to publish the user's self-logged adherence back into ABDM, which no one is asking for and which would force M2 (the milestone every guide calls the hardest).
- Because M1-only cannot exit the sandbox, the minimum production integration for a medication app is **M1 + M3**, which is precisely the pair that includes full consent-artefact handling, Fidelius decryption, and revocation-driven data purge. There is no cheap production tier.
- The **public HTTPS callback requirement** is a structural problem for a solo developer: it means the app cannot be client-only. You need an always-on, TLS-terminated, publicly addressable server with stable certificates and correct clock sync (clock drift causing signed-token rejection is listed as a common failure).
- The requirement to **purge records and keys on consent revocation or expiry** is a real engineering and legal obligation, not a checkbox — it has to be designed into storage from day one, including backups.

### Gaps
- **No published rupee cost for NHA functional testing or a CERT-In WASA audit.** Market rates for CERT-In audits exist but I found no ABDM-specific figure in sources; this is the key unknown for a solo-dev budget.
- **No confirmed end-to-end timeline** from sandbox registration to production keys. No source gave a median.
- **Unresolved: whether NHA empanels individual/unincorporated developers at all**, or requires a registered legal entity, GST, etc. No source addressed this, and it may be a hard blocker for a solo developer.
- Whether a PHR app has a distinct, lighter empanelment track from an HIS vendor — Eka's docs assert PHR is "a separate track" but give no NHA process for it.

---

## Q4. API capabilities and data formats — is prescription data actually flowing?

### Takeaway
The data model is genuinely good: FHIR R4 with a dedicated **PrescriptionRecord** profile that maps cleanly onto a medication tracker's needs. The problem is supply, not schema — the records only exist if the prescribing facility is an ABDM HIP that publishes them, most Indian prescriptions are still paper or a scanned PDF stuffed into a `Binary` resource, and medicine coding is bound only as an *example*, so even conformant bundles may carry free-text drug names.

### Cited Findings
- The current standard is the **NRCeS FHIR Implementation Guide for ABDM v6.5.0**, built on **FHIR R4 (4.0.1)**, published as package `ndhm.in` — [NRCeS IG home](https://nrces.in/ndhm/fhir/r4/); version corroborated by [Nirmitee FHIR bundles guide](https://nirmitee.io/blog/understanding-abdm-fhir-bundles-complete-guide-zero-to-expert/)
- **PrescriptionRecord** is a Composition profile for "medication advice given to patients", aligned with Pharmacy Council of India guidelines; it fixes the Composition type to SNOMED CT **440545006 ("Prescription record")** and requires a Patient subject. The profile's JSON representation was **last updated March 2025** — [PrescriptionRecord profile](https://www.nrces.in/ndhm/fhir/r4/StructureDefinition-PrescriptionRecord.html); [JSON representation](https://nrces.in/ndhm/fhir/r4/StructureDefinition-PrescriptionRecord.profile.json.html)
- Individual medicines are carried as **MedicationRequest** resources. **Medicine codes are bound to the IG's MedicineCodes value set as an *example* binding, not a required one** — [MedicationRequest profile](https://www.nrces.in/ndhm/fhir/r4/StructureDefinition-MedicationRequest.html). A **MedicationStatement** profile also exists — [MedicationStatement profile](https://nrces.in/ndhm/fhir/r4/StructureDefinition-MedicationStatement.html)
- An ABDM bundle is a FHIR **document** Bundle with a Composition at its head; a prescription bundle typically pairs a Composition with one MedicationRequest per medicine, **plus a `Binary` for a scanned copy** — [Nirmitee FHIR bundles guide](https://nirmitee.io/blog/understanding-abdm-fhir-bundles-complete-guide-zero-to-expert/) (secondary source)
- The India-specific record types available over HIE-CM include **OP Consultation, IP Discharge Summary, Diagnostic Report and Prescription Record** — [OpenMalo developer guide](https://www.openmalo.com/blog/abdm-integration-developer-guide)
- **Common PHR rendering failure:** bundles showing "NA" in PHR apps stem from non-conformant FHIR bundles produced by HIPs — [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- Most-cited integration failure modes: FHIR profile mismatches, consent edge cases (revocation, expiry, partial consent), clock drift invalidating signed tokens, incorrect HFR linkage — [OpenMalo developer guide](https://www.openmalo.com/blog/abdm-integration-developer-guide). One guide names **M2's consent flow and data transfer** as the single most common failure area — [Nirmitee integration guide](https://nirmitee.io/blog/step-by-step-guide-for-abdm-integration/)

### Inferences
- **Yes, an HIU can in principle fetch prescriptions and discharge summaries** — the profiles exist and the consent flow supports it. The honest question is the hit rate, and based on ~1.1 records per ABHA (Q1), the expected number of retrievable prescriptions for a typical Indian user today is near zero.
- Because MedicineCodes is only an *example* binding, a medication app **cannot assume coded drug identifiers** in incoming bundles. It must handle free-text `medicationCodeableConcept.text` and scanned-PDF `Binary` attachments. That means any "import my prescription and auto-create reminders" feature needs name-matching or OCR anyway — which drastically reduces the marginal value of the HIE-CM integration versus simply letting the user photograph the prescription.
- The "NA in PHR apps" failure mode is a strong signal that **real-world bundle quality is poor**, independent of volume. Even where records exist, a consumer app will render blanks for a meaningful share of them.
- The combination of (low volume) + (optional coding) + (scanned attachments) + (poor conformance) means the HIE-CM integration would deliver an unreliable feature at high cost — the worst shape for a small product.

### Gaps
- **No data found on real-world conformance rates or the proportion of prescription bundles that are structured MedicationRequest vs scanned `Binary`.** This is decisive for the feature's viability and is unmeasurable from outside the network.
- No evidence found either way on whether **retail pharmacies** publish dispensing records as HIPs — which would be the richer source for adherence than hospital prescriptions.

---

## Q5. Mandatory security / compliance requirements

### Takeaway
There is **no ISO 27001 or SOC 2 requirement** in any source found. The binding gate is a **CERT-In-empanelled WASA security audit producing a Safe-to-Host certificate**, plus the Health Data Management Policy's technical controls. The audit is the single largest fixed compliance cost and must be partly redone when the app changes materially — which is fatal for a fast-iterating small product.

### Cited Findings
- **WASA audit by a CERT-In empanelled auditor** is required, producing a **final WASA report, a Vulnerability Closure Certificate and a Safe-to-Host certificate**, which NHA requires for production access — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- Earlier ABDM guidance allowed STQC-accredited agencies for WASA; current guidance emphasises CERT-In empanelment, and **STQC may randomly sample applications during functional testing** — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **HDM Policy technical controls as listed:** AES-256 encryption for data at rest, **TLS 1.2 or higher** in transit, role-based access with least privilege, **OAuth 2.0** for ABDM API authentication, audit logging, and privacy-by-design — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **ISO 27001 is not presented as an ABDM requirement** in the certification guide — it appears there only as the author's own company badge — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **Re-audit exposure:** adding features after a WASA audit may require repeating part of the audit, at extra cost — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- Gateway flows use signed JWTs and verifiable credentials; recommended practice includes pinned certificates where required, time-bounded tokens with rotation, and audit logs — [OpenMalo developer guide](https://www.openmalo.com/blog/abdm-integration-developer-guide)
- **Consent-expiry obligation:** an HIU must purge data and keys when consent is revoked or expires — [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- A third-party commentary states a health app may need to **register as a PHR app with NHA if it stores health records** — [productgrowth.in, ABDM Digital Health Regulations](https://productgrowth.in/insights/healthtech/abdm-digital-health-regulations/). That page also carries a "500M+ accounts" figure not backed by an official source, so treat the whole page as low-confidence.
- Vendor commentary on 2026 compliance says organisations are "expected to support" ABHA creation/linking and consent-based sharing but **describes no formal mandate**; it does not mention the DPDP Act, HDM Policy, data localisation, ISO 27001 or audits — [Eka Care, May 2026](https://www.eka.care/services/abdm-adoption-in-2026-what-hospitals-must-know)

### Inferences
- The compliance burden is **front-loaded and lumpy**: a one-off paid audit plus a one-off paid functional test, rather than a recurring subscription. For a funded startup that is a rounding error; for a solo developer shipping weekly, the re-audit-on-change rule is the killer, because it couples release velocity to a third-party auditor's calendar.
- Nothing in the sources suggests ABDM empanelment is required merely to **display** an ABHA number a user typed in, or to call a public reference registry. The compliance regime attaches to touching the HIE-CM and holding other people's clinical records.

### Gaps
- **The DPDP Act 2023's operative rules and their application to a health app were not covered by any source retrieved.** Given the Act's phased rulemaking, its 2026 status for health data (consent manager registration, data fiduciary obligations, breach notification, children's data) is a material unknown and should be researched separately — it likely binds a medication app *regardless* of ABDM integration.
- **No source found confirming or denying a data-localisation / India-hosting requirement** for ABDM-integrated apps. The HDM Policy is widely believed to require it but I found no citable statement in these results. Do not assume either way.
- No published cost for a CERT-In WASA audit in the ABDM context.
- Whether ABDM empanelment requires a registered Indian legal entity — unaddressed everywhere.

---

## Q6. Is there a realistic lightweight path?

### Takeaway
Yes, three of them, in ascending cost: (a) treat the ABHA number as a plain user-entered field with validation — zero integration, zero compliance; (b) use the **National Drug Registry** for medicine autocomplete — likely free and outside the empanelment regime, and by far the best value; (c) route M1 ABHA login through an **aggregator like Eka Care's ABDM Connect**, which absorbs the gateway and possibly the empanelment burden. Full M1+M3 HIE-CM is not a lightweight path and cannot be made into one, because NHA will not let you exit the sandbox on M1 alone.

### Cited Findings
- **M1 enables ABHA only.** Sharing consultation records needs M2; viewing records from other providers needs M3 — [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- **But M1-only cannot reach production:** NHA Integration Support quoted as requiring "any 2 milestones to be completed to exit sandbox" — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/) (the author flags this as unverified with NHA directly)
- **Open-source M1 middleware exists:** a Flask gateway sitting between client apps and the ABDM v3 APIs that holds the NHA credentials, encrypts sensitive fields with RSA-OAEP, and covers ABHA creation, login/verification, profile, card and QR — [h-wardhan/abdm-gateway](https://github.com/h-wardhan/abdm-gateway)
- **Aggregator route:** Eka Care describes **ABDM Connect** as a "plug-and-play API and SDK suite that handles the ABDM gateway complexity for you", covering ABHA create/login, profile, card, QR check-in, HIP record linking, HIU consent-and-receive, and PHR consent approval/revocation with new-record notifications. Eka states it is "the first private company approved to issue health ID/s under ABDM guidelines" — [Eka Developer Platform](https://developer.eka.care/integrations/interoperability/abdm); [Eka ABDM Connect](https://www.eka.care/s/for-developers/abdm-connect-api); [BioSpectrum India](https://www.biospectrumindia.com/news/98/19837/eka-care-creates-health-id-under-abdm.html)
- The **NHA's own ABHA Mobile app is a reference PHR app** integrators can build against, using login/registration and consent-manager APIs from the sandbox — [coronasafe ABHA Mobile (PHR) docs](https://docs.coronasafe.network/abdm-documentation/implementers-guide/abha-mobile-phr-application)
- **Scan & Share** is the patient-side lightweight primitive: the patient scans a facility QR in their PHR app and shares their profile; the facility system returns a queue token (valid 30 minutes, sequential per counter per day) — [search summary of ABDM M1 guides](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- Avni, an open-source community-health platform, has public issues scoping exactly this incremental approach — "ABDM M1: show, download and share the ABHA card", "ABDM M1: the ABHA section on a patient's profile", and "find or create a patient's ABHA at registration, **through Eka Care**" — [avni-client #2204](https://github.com/avniproject/avni-client/issues/2204); [avni-client #2205](https://github.com/avniproject/avni-client/issues/2205); [avni-product #1912](https://github.com/avniproject/avni-product/issues/1912)

### Inferences
- The Avni issue titled "find or create a patient's ABHA at registration, **through Eka Care**" is the most useful single data point in this research: a serious open-source health project with real resources chose to reach ABHA **via an aggregator rather than direct NHA empanelment**. That is the template for a small team.
- Recording an ABHA number as a profile field needs no integration at all. The 14-digit format is well known and checksum-validatable locally. This gives the user a sense of "this app speaks ABDM" at essentially zero cost — a legitimate UX move, as long as the app does not imply it is fetching anything.
- The **Drug Registry is the asymmetric bet**: it plausibly requires nothing but an API key (or nothing at all), it is reference data not patient data, and it solves a problem the app definitely has. It should be validated manually before anything else in ABDM is considered.

### Gaps
- **Eka Care's ABDM Connect pricing is not published**, and the critical question — whether using an aggregator removes the need for the integrator's *own* NHA empanelment and WASA audit, or merely reduces the code — is **not answered by any source found**. This determines whether the aggregator route is genuinely lightweight or just a thinner wrapper on the same compliance bill. It should be asked of Eka directly.
- No source confirms whether an aggregator-mediated app still needs to register as a PHR app with NHA.

---

## Q7. Cost/benefit for a solo developer

### Takeaway
On the evidence, **full HIE-CM integration is not worth it for a solo developer in 2026** — it is a multi-month, multi-vendor, paid-audit project whose payoff is fetching records that mostly do not exist yet, in a format that is only optionally coded. The National Drug Registry, by contrast, is worth investigating this week. The correct posture is: build the drug-registry lookup now, store the ABHA number as a field, design the data model so a future HIU fetch can be slotted in, and revisit HIE-CM when there is public evidence of prescription bundles actually flowing at volume.

### Cited Findings
- **Costs are real but unquantified in public sources:** the integrator pays for NHA functional testing (self-certification prohibited), pays a CERT-In empanelled auditor for WASA, and may pay again to re-audit after feature changes — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/)
- **Calendar risk:** agency slots fill up, especially near quarter-ends; timelines depend on fix-and-retest cycles and NHA's testing queue — [Nirmitee certification guide](https://nirmitee.io/blog/abdm-certification-process-sandbox-to-production-guide/); [Nirmitee milestones guide](https://nirmitee.io/blog/abdm-integration-milestones-m1-m2-m3-m4-multi-software-guide/)
- **Infrastructure requirement:** a public HTTPS callback endpoint with correct clock sync, because the gateway calls you — [Nirmitee integration guide](https://nirmitee.io/blog/step-by-step-guide-for-abdm-integration/); [OpenMalo developer guide](https://www.openmalo.com/blog/abdm-integration-developer-guide)
- **Expected payoff is thin:** ~105 crore records against ~94 crore ABHA accounts ([Srishti IAS / MSG 10 Jul 2026](https://srishtiias.com/ayushman-bharat-digital-mission-abdm-abha-health-id-2026/)); ~51% of registered facilities running ABDM-enabled software (same source); 23.96% ABHA registration rate even at hospitals actively pushing it ([PMC13078079](https://pmc.ncbi.nlm.nih.gov/articles/PMC13078079/)); ~0.3% linkage in national health programmes ([SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7466598), unverified)
- **User-side friction is measured and high:** 60% hesitancy to share OTPs, 65.6% difficulty using health apps, 64% language difficulty, 88% needing training — [PMC13078079](https://pmc.ncbi.nlm.nih.gov/articles/PMC13078079/)
- **Counterpoint — one vendor's positive read:** a developer guide calls ABDM "genuinely good infrastructure" and says the developer experience "improves every quarter". This is vendor-style blog opinion, not evidence — [summarised from ABDM developer guide search results](https://www.openmalo.com/blog/abdm-integration-developer-guide)
- **Genuine upside that does exist:** the Drug Registry's 123,000+ branded medicines, 10,000+ generics and ~29,000 substances with SNOMED CT coding and stated open APIs — [Digital Health News](https://www.digitalhealthnews.com/india-launches-national-drug-registry-under-abdm-bringing-standardized-medicine-information-nationwide)

### Inferences
- **Sequencing recommendation for a medication tracker:**
  1. **Now (days):** manually probe `drugregistry.abdm.gov.in` and `drugregistrysbx.abdm.gov.in/dr/v3` to confirm whether the open API is genuinely open. If so, build medicine autocomplete on it and cache locally. Highest value, lowest cost, no compliance exposure.
  2. **Now (hours):** add an optional ABHA number field with local format validation. No claims of fetching.
  3. **Later (if a real user need appears):** M1 ABHA login via an aggregator, after getting a written answer from the aggregator on whether it removes the empanelment/audit obligation.
  4. **Aspiration only:** M1+M3 HIU over HIE-CM. Revisit when NHA or a credible third party publishes consent-request volumes or structured-prescription counts, not ABHA-account counts.
- Designing the local medication schema around the NRCeS **MedicationRequest** shape now costs nothing and makes a future import path cheap. This is the right hedge: adopt the *standard*, defer the *integration*.
- The strongest argument *against* waiting is competitive/regulatory: if ABDM participation becomes a de facto requirement for app-store visibility or partnerships in India. No source found indicates any such mandate exists for consumer apps as of October 2026 — vendor commentary explicitly describes "expected to support" rather than any formal mandate ([Eka Care, May 2026](https://www.eka.care/services/abdm-adoption-in-2026-what-hospitals-must-know)).

### Gaps
- **No rupee figures anywhere** for NHA functional testing, CERT-In WASA audit, or aggregator fees. Every cost statement above is directional, not quantified. A solo developer should get three quotes before treating full integration as even theoretically on the table.
- **No developer-forum or firsthand complaint data retrieved.** Searching for frustration with the sandbox returned only vendor guides; Reddit, the NHA sandbox support forum, and GitHub discussion threads were not successfully mined and would likely be the most honest source on real effort.
- **No evidence found on whether any consumer medication/adherence app in India has completed ABDM HIU integration** — the absence of such a reference implementation is itself weak evidence that the cost/benefit does not currently clear for this category, but it is an absence of evidence, not evidence of absence.

---

## Q8. UHI, e-Pharmacy and an official drug database for autocomplete

### Takeaway
This is the one unambiguously good news item: India now has an **official national drug database** — the ABDM **National Drug Registry**, SNOMED CT-coded, covering 123,000+ branded medicines, with government-stated open APIs. It is exactly what a medication tracker needs for name autocomplete and is almost certainly obtainable without the HIE-CM compliance regime. UHI's pharmacy-discovery layer, which would enable refill flows, is announced but not yet live.

### Cited Findings
- **National Drug Registry:** launched under ABDM by Union Health Minister J.P. Nadda as a "single source of truth for medicines in India", developed with **CDSCO** and **NRCeS Pune**; contains **123,000+ branded medicines, 10,000+ generic drugs, ~29,000 drug substances**; coded with **SNOMED CT**; searchable by generic name, brand name, active substance and manufacturer; stated to provide **open APIs** for healthcare providers, software platforms and digital services; designed to integrate with HMIS, e-prescription platforms and doctor-facing applications — [Digital Health News](https://www.digitalhealthnews.com/india-launches-national-drug-registry-under-abdm-bringing-standardized-medicine-information-nationwide) (updated 02 Jul 2026); [India Pharma Outlook](https://www.indiapharmaoutlook.com/news/government-initiates-all-in-one-medicine-info-platform-nwid-5471.html); [PIB PRID 2278991](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278991&reg=48&lang=2) (403 to automated fetch; search index reports portal **drugregistry.abdm.gov.in** and sandbox **drugregistrysbx.abdm.gov.in/dr/v3**)
- NHA ran a formal public consultation on the Drug Registry design; Practo's recommendations are hosted on abdm.gov.in — [Practo recommendations](https://abdm.gov.in/strapicms/uploads/Practo_Recommendations_NHA_Drug_Registry_1a52739a6a.pdf)
- **UHI** launched **29 June 2026**; it is the ABDM service layer, NHA-maintained, with participation limited to HPR/HFR-credentialled doctors and facilities; four citizen services reported operational, mainly clinic discovery and booking — [PIB PRID 2278987](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278987&reg=48&lang=1) via [VisionIAS](https://visionias.in/current-affairs/news-today/2026-06-30/society/unified-health-interface-uhi-launched-along-with-other-digital-health-initiatives); [Omnicuris](https://www.omnicuris.com/medshots/editorial_picks/unified-health-interface-india-digital-healthcare-revolution); [Devdiscourse](https://www.devdiscourse.com/article/health/3942408-jp-nadda-launches-unified-health-interface-for-digital-care)
- **Pharmacy discovery across private and government outlets is listed as an upcoming UHI phase**, alongside lab diagnostics discovery and vaccination slot booking. No dates announced — [PIB PRID 2278987](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2278987&reg=48&lang=1) via [VisionIAS](https://visionias.in/current-affairs/news-today/2026-06-30/society/unified-health-interface-uhi-launched-along-with-other-digital-health-initiatives)
- The **ABDM sandbox building-block list** maintained by the community covers ABHA, HIE-CM, HPR and HFR — **the Drug Registry is not on it**, suggesting it sits on separate infrastructure — [kiranma72.github.io/abdm-docs](https://kiranma72.github.io/abdm-docs/)
- A **non-official** commercial drug API, drugdb.in, exposes `GET /search` routes and claims to resolve Indian medicine names to SNOMED CT identifiers — [drugdb.in](https://drugdb.in/). Unverified; listed only as a fallback if the official registry proves inaccessible. Another commercial Indian medicine dataset vendor: [datarequisite.com](https://datarequisite.com/)
- For comparison, the US equivalent (**openFDA NDC Directory**) is fully public domain under CC0 1.0 with optional API keys — [openFDA](https://open.fda.gov/apis/). No equivalent licensing statement was found for India's Drug Registry.

### Inferences
- The Drug Registry living on `drugregistry.abdm.gov.in` with its own `/dr/v3` sandbox — and **not appearing in the HIE-CM sandbox building-block list** — strongly suggests it is a standalone reference service with its own, lighter access path. That is the hypothesis to test first.
- SNOMED CT coding means the registry is directly usable as the canonical medicine vocabulary for the app's internal model, and it aligns with the NRCeS MedicationRequest profile's MedicineCodes value set — so building on it now also prepares for any future FHIR import.
- 123,000 branded entries is credible for the Indian market and far beyond what any hand-curated list would achieve. Even if the API turns out to require sandbox credentials, obtaining credentials for a read-only reference registry is a much lower bar than HIU empanelment.
- UHI pharmacy discovery is the feature that would make a medication app genuinely useful at the refill moment. It is worth tracking, but nothing can be built against it today.

### Gaps
- **The Drug Registry's actual API spec, auth model, rate limits, licensing and caching/bulk-download terms are all unverified.** Both `drugregistry.abdm.gov.in` and the PIB release resisted automated fetching (JS-rendered app; PIB returns HTTP 403). **This must be checked manually in a browser** — it is the single highest-value follow-up from this research.
- Unknown whether the registry carries **strength, dosage form, pack size, pricing, or schedule (H/H1/X) classification** — all of which matter for a medication tracker. Only the four search fields (generic, brand, substance, manufacturer) are confirmed.
- No information found on the Drug Registry's update cadence or on how discontinued brands are handled.
- No source found on the state of **e-pharmacy regulation** in India as of 2026 (the long-pending amendments to the Drugs and Cosmetics Rules); not covered by the searches run.
