import { Routes, Route, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, Globe2, LifeBuoy, Megaphone, Palette, Send, ShoppingCart } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import { getStoredUser, saveAuthSession, getStoredToken } from "../../utils/authStorage";

const EMAIL_PACKAGE_IDS = [
  "informative-startup",
  "informative-professional",
  "ecommerce-startup",
  "ecommerce-professional",
  "ecommerce-business",
  "domain-email",
  "email",
];

const customerPackages = [
  {
    category: "Informative Websites",
    packages: [
      {
        id: "informative-basic",
        title: "Basic Website Package",
        monthly: "£29",
        annual: "£299",
        icon: Globe2,
        description: "A clean starter website for businesses that need a professional online presence.",
        features: ["Logo Design (complementary)", "Informative Website (3-4 pages)", "Domain Name", "Shared Web Hosting", "Mobile Responsive", "SSL Certificate", "Website Security+", "Website Speed+", "Contact Forms", "100% Ownership", "Dedicated project manager"],
      },
      {
        id: "informative-startup",
        title: "Startup Website Package",
        monthly: "£39",
        annual: "£399",
        icon: Globe2,
        description: "A stronger website package with business email and social media integration.",
        features: ["Logo Design (complementary)", "Informative Website (4-5 pages)", "Domain Name", "Shared Web Hosting", "Business Email", "Mobile Responsive", "Social Media Integration", "SSL Certificate", "Website Security+", "Website Speed+", "Contact Forms", "100% Ownership", "Dedicated project manager"],
      },
      {
        id: "informative-professional",
        title: "Professional Website Package",
        monthly: "£49",
        annual: "£499",
        icon: Globe2,
        description: "A larger informative website with booking features and full launch essentials.",
        features: ["Logo Design (complementary)", "Informative Website (6-10 pages)", "Domain Name", "Shared Web Hosting", "Booking System", "Business Email", "Mobile Responsive", "Social Media Integration", "SSL Certificate", "Website Security+", "Website Speed+", "Contact Forms", "100% Ownership", "Dedicated project manager"],
      },
    ],
  },
  {
    category: "E-Commerce Websites",
    packages: [
      {
        id: "ecommerce-startup",
        title: "Startup E-commerce Web Store",
        monthly: "£29",
        annual: "£299",
        icon: ShoppingCart,
        description: "A compact online store for launching products quickly with payment support.",
        features: ["Online store setup", "Up to 10 Products", "Standard Responsive Design", "Shopping Cart Integration", "Mobile/Tablet Responsive", "Social Media Integration", "Payment gateway integration (PayPal, Stripe, card payments)", "Basic SEO setup", "1 Email Account (linked to the domain)", "Easy Product Search", "Product Categories & Filters", "Contact Forms", "Dedicated Project Manager"],
      },
      {
        id: "ecommerce-professional",
        title: "Professional E-commerce Web Store",
        monthly: "£49",
        annual: "£499",
        icon: ShoppingCart,
        description: "A fuller store setup for growing catalogs and multi-mailbox operations.",
        features: ["Online store setup", "Up to 10-50 Products", "Standard Responsive Design", "Shopping Cart Integration", "Mobile/Tablet Responsive", "Social Media Integration", "Payment gateway integration (PayPal, Stripe, card payments)", "Basic SEO setup", "2-3 Email Accounts (linked to the domain)", "Easy Product Search", "Product Categories & Filters", "Contact Forms", "Dedicated Project Manager"],
      },
      {
        id: "ecommerce-business",
        title: "Business E-commerce Web Store",
        monthly: "£69",
        annual: "£799",
        icon: ShoppingCart,
        description: "A business-ready e-commerce package for larger inventories and teams.",
        features: ["Online store setup", "Up to 100 Products", "Standard Responsive Design", "Shopping Cart Integration", "Mobile/Tablet Responsive", "Social Media Integration", "Payment gateway integration (PayPal, Stripe, card payments)", "Basic SEO setup", "4-5 Email Accounts (linked to the domain)", "Easy Product Search", "Product Categories & Filters", "Contact Forms", "Dedicated Project Manager"],
      },
    ],
  },
  {
    category: "Domain And Email",
    packages: [
      {
        id: "domain-email",
        title: "Domain And Email Package",
        monthly: "£12",
        annual: "£164",
        icon: AtSign,
        description: "Domain registration plus professional business email accounts.",
        features: ["Custom Domain Name Registration (e.g., yourbrand.com)", "Up to 5 Professional Email Accounts (e.g., info@yourbrand.com)", "5 GB Mailbox Storage per Email ID", "DNS & Domain Support", "Domain Privacy Protection", "Webmail & Mobile Access"],
      },
    ],
  },
  {
    category: "Social Media Management",
    packages: [
      {
        id: "social-basic",
        title: "Social Media Starter",
        monthly: "£29",
        annual: "£269",
        icon: Megaphone,
        description: "A simple monthly social presence package with planned content.",
        features: ["Management of 1-2 social platforms", "4 Social Media Posts per month", "Content creation included", "Content Calendar Planning", "Basic Audience Targeting", "Monthly report"],
      },
      {
        id: "social-management",
        title: "Social Media Management",
        monthly: "£59",
        annual: "£269",
        icon: Megaphone,
        description: "A stronger content package with reels, targeting, and competitor insight.",
        features: ["Management of 1-2 platforms", "8 Social Media Posts per month", "Content creation included", "Content Calendar Planning", "1 Video Content Creation (Reels) High Quality", "Enhanced Audience Targeting", "Monthly report", "Competitor Analyst Report"],
      },
    ],
  },
  {
    category: "Branding",
    packages: [
      {
        id: "branding-design",
        title: "Branding Design Package",
        monthly: "£79",
        annual: "",
        icon: Palette,
        description: "A polished visual identity kit for brand launches and refreshes.",
        features: ["Premium Logo (2 Design Concepts)", "Business Card Design", "Invoice Design", "Letter Head Design", "One Page Flyer Design (A5 or A4)", "Unlimited Revisions", "Final Files (PDF and JPEG)"],
      },
    ],
  },
];

const packages = customerPackages.flatMap((group) => group.packages);
const VALID_PACKAGE_IDS = new Set(packages.map((item) => item.id));
const INFORMATIVE_PACKAGE_IDS = ["informative-basic", "informative-startup", "informative-professional"];
const ECOMMERCE_PACKAGE_IDS = ["ecommerce-startup", "ecommerce-professional", "ecommerce-business"];
const LOGO_PACKAGE_IDS = [...INFORMATIVE_PACKAGE_IDS, "branding-design"];

const getSelectedPackageId = (item) => (typeof item === "string" ? item : item?.packageId || item?.id || "");
const normalizeSelectedPackages = (selectedPackages = []) =>
  Array.isArray(selectedPackages)
    ? selectedPackages.filter((item) => VALID_PACKAGE_IDS.has(getSelectedPackageId(item)))
    : [];
const getSelectedPackageBillingCycle = (item) => (typeof item === "string" ? "monthly" : item?.billingCycle || "monthly");
const hasSelectedPackageId = (selectedPackages = [], packageIds = []) =>
  selectedPackages.some((item) => packageIds.includes(getSelectedPackageId(item)));
const findSelectedPackage = (selectedPackages = [], packageId) =>
  selectedPackages.find((item) => getSelectedPackageId(item) === packageId);

const hasEmailPackage = (selectedPackages = []) => hasSelectedPackageId(selectedPackages, EMAIL_PACKAGE_IDS);
const hasLogoPackage = (selectedPackages = []) => hasSelectedPackageId(selectedPackages, LOGO_PACKAGE_IDS);

/*
const oldPackages = [
  {
    id: "website",
    title: "Website Package",
    price: "Custom quote",
    icon: Globe2,
    description: "Business websites, landing pages, redesigns, and conversion-focused pages.",
    features: ["Design direction", "Page structure", "Content sections", "Launch checklist"],
  },
  {
    id: "logo",
    title: "Logo Package",
    price: "Custom quote",
    icon: Palette,
    description: "A clear identity starter for new brands, campaigns, or refreshed businesses.",
    features: ["Brand mood", "Logo direction", "Color preferences", "Usage notes"],
  },
  {
    id: "domain",
    title: "Domain Package",
    price: "Market price",
    icon: Globe2,
    description: "Domain search, domain setup, DNS help, and launch-ready connection.",
    features: ["Domain ideas", "Availability review", "DNS guidance", "Renewal notes"],
  },
  {
    id: "email",
    title: "Business Email Package",
    price: "Per inbox",
    icon: AtSign,
    description: "Professional email accounts for your team, connected to your domain.",
    features: ["Mailbox setup", "Aliases", "DNS records", "Device guidance"],
  },
];
*/

const requestLabels = {
  logo: "Logo Request",
  website: "Website Request",
  domain: "Domain Request",
  email: "Email Request",
  ticket: "Support Ticket",
};

const websiteSubscriptionTerms = [
  "By subscribing to our website package, you acknowledge and agree that this service is provided on the basis of a minimum 12-month contractual agreement once your domain name has been registered by us.",
  "The subscription includes the design and development of your website, hosting on our servers, registration of your chosen domain name, and the provision of one professional email account (if applicable). From the point at which we register the domain on your behalf, you are contractually obliged to maintain the subscription for at least 12 months, as the domain and hosting services are secured in advance for your benefit.",
  "Payment of the monthly subscription is due in advance each month. If payments are not received on time, services may be suspended until the account is brought up to date. In accordance with the Late Payment of Commercial Debts (Interest) Act 1998, overdue amounts may incur statutory interest and reasonable recovery costs. Where accounts remain unpaid, we may instruct external collection services, and such action can impact your credit record in the United Kingdom.",
  "Your subscription will automatically continue on a rolling monthly basis after the initial 12-month period unless you provide 30 days' written notice of cancellation. Early cancellation during the minimum term is not permitted, as the costs of domain registration, hosting, and development are committed upfront and non-refundable.",
  "All services are delivered in accordance with UK law, including the Consumer Rights Act 2015, and any disputes arising under this agreement shall be subject to the exclusive jurisdiction of the courts of England and Wales.",
  "By proceeding with this subscription, you confirm that you have read, understood, and accepted these Terms and Conditions.",
];

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#632dff] focus:ring-2 focus:ring-[#632dff]/20";
const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

const Guideline = ({ text, image, imageAlt = "Guideline example" }) => {
  if (!text && !image) return null;

  return (
    <div className="mt-2 space-y-2">
      {text && <p className="text-sm leading-5 text-slate-500">{text}</p>}
      {image && (
        <img
          src={image}
          alt={imageAlt}
          className="max-h-56 w-full rounded-lg border border-slate-200 object-contain"
          loading="lazy"
        />
      )}
    </div>
  );
};

const RequiredMark = ({ show }) => show ? <span className="ml-1 text-red-500">*</span> : null;
const FieldError = ({ message }) => message ? <p className="mt-2 text-sm font-medium text-red-600">{message}</p> : null;

const TextInput = ({ label, value, onChange, placeholder, type = "text", required = true, error = "" }) => (
  <label className="block">
    <span className={labelClass}>{label}<RequiredMark show={required} /></span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className={`${inputClass} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""}`} />
    <Guideline text={placeholder} />
    <FieldError message={error} />
  </label>
);

const TextArea = ({ label, value, onChange, placeholder, required = true, error = "" }) => (
  <label className="block">
    <span className={labelClass}>{label}<RequiredMark show={required} /></span>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} rows={5} className={`${inputClass} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""}`} />
    <Guideline text={placeholder} />
    <FieldError message={error} />
  </label>
);

const SelectInput = ({ label, value, onChange, options = [], placeholder = "Select an option", required = false, error = "" }) => (
  <label className="block">
    <span className={labelClass}>{label}<RequiredMark show={required} /></span>
    <select value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} className={`${inputClass} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""}`}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    <FieldError message={error} />
  </label>
);

const FileInput = ({ label, value, onChange, multiple = false, required = false, error = "" }) => (
  <label className="block">
    <span className={labelClass}>{label}<RequiredMark show={required} /></span>
    <input
      type="file"
      multiple={multiple}
      required={required}
      onChange={(event) => onChange(multiple ? [...event.target.files].map((file) => file.name) : event.target.files[0]?.name || "")}
      className={`w-full rounded-lg border border-dashed border-[#632dff]/30 bg-[#632dff]/5 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#1c5cb6] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white ${error ? "border-red-400" : ""}`}
    />
    {value && <p className="mt-2 text-xs text-slate-500">{Array.isArray(value) ? value.join(", ") : value}</p>}
    <FieldError message={error} />
  </label>
);

const ColorInput = ({ label, value = {}, onChange, required = false }) => (
  <div>
    <span className={labelClass}>{label}</span>
    <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
      <input
        type="color"
        value={value.color || "#1c5cb6"}
        onChange={(event) => onChange({ ...value, color: event.target.value })}
        className="h-12 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
        required={required}
      />
      <input
        value={value.code || ""}
        onChange={(event) => onChange({ ...value, code: event.target.value })}
        className={inputClass}
        required={required}
      />
    </div>
    <Guideline text="#1c5cb6, navy blue, gold..." />
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/70 ${className}`}>{children}</div>
);

const syncStoredCustomer = (summary) => {
  if (!summary?.user) return;
  const token = getStoredToken();
  if (!token) return;

  const currentUser = getStoredUser();
  const sameUser = currentUser?._id === summary.user._id;
  const nextUser = {
    ...(sameUser ? currentUser : {}),
    ...summary.user,
    role: "customer",
    customerProfile: {
      ...(sameUser ? currentUser?.customerProfile : {}),
      ...(summary.user.customerProfile || {}),
      selectedPackages: normalizeSelectedPackages(summary.selectedPackages),
    },
  };

  saveAuthSession(token, nextUser);
  window.dispatchEvent(new Event("apollo:user-updated"));
};

function useCustomerData() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/customer/summary");
      syncStoredCustomer(data);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    API.get("/customer/summary")
      .then(({ data }) => {
        if (active) {
          syncStoredCustomer(data);
          setSummary(data);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { summary, loading, load };
}

function CustomerHome() {
  const { summary, loading } = useCustomerData();
  const requests = summary?.requests || [];
  const selectedPackages = normalizeSelectedPackages(summary?.selectedPackages);
  const activeRequests = requests.filter((item) => !["completed", "closed"].includes(item.status));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#632dff]/20 bg-[radial-gradient(circle_at_top_right,rgba(188,38,255,0.16),transparent_24rem),linear-gradient(135deg,#ffffff,#eef4ff)] p-6 shadow-2xl shadow-slate-200/80">
        <img src="/aqua-design-works-logo.webp" className="mb-5 h-20 w-44 rounded-xl object-contain" />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Aqua Design Works</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-950">Welcome back, {summary?.user?.name || getStoredUser()?.name || "customer"}.</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Choose packages, submit project details, and keep every request in one clean place.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Selected packages</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{selectedPackages.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Open requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{activeRequests.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Total submissions</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{requests.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-slate-950">Recent activity</h2>
        <div className="mt-4 space-y-3">
          {loading && <p className="text-slate-500">Loading...</p>}
          {!loading && requests.slice(0, 5).map((request) => (
            <div key={request._id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{request.title}</p>
                <p className="text-sm capitalize text-slate-500">{requestLabels[request.type]} - {request.status.replace("_", " ")}</p>
              </div>
              <span className="w-fit rounded-full border border-[#632dff]/30 bg-[#632dff]/10 px-3 py-1 text-xs font-semibold text-[#bc26ff]">
                {new Date(request.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {!loading && requests.length === 0 && <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-500">No requests yet. Pick a package and submit your first form.</p>}
        </div>
      </Card>
    </div>
  );
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (event) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = getPoint(event);
    drawingRef.current = true;
    canvas.setPointerCapture?.(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1c5cb6";
  }, []);

  return (
    <div className="sm:col-span-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={labelClass}>Signature</span>
        <button type="button" onClick={clear} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#632dff]/40 hover:text-[#632dff]">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={220}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        className={`h-44 w-full touch-none rounded-xl border bg-white ${value ? "border-[#632dff]/40" : "border-slate-200"}`}
      />
      <p className="mt-2 text-xs text-slate-500">Draw your signature above. This field is required.</p>
    </div>
  );
}

function TermsConsentCard({ request, onSubmitted }) {
  const user = getStoredUser();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", signature: "" });
  const [fieldErrors, setFieldErrors] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirmedDomain = request.details?.confirmedDomain || request.details?.preferredDomain || request.title;

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      if (hasFormValue(value)) next.delete(key);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const missingFields = new Set(["name", "email", "signature"].filter((key) => !hasFormValue(form[key])));
    setFieldErrors(missingFields);
    if (missingFields.size) {
      setError("Please complete the required fields marked below before submitting.");
      return;
    }
    setSaving(true);
    try {
      await API.post(`/customer/requests/${request._id}/terms-consent`, form);
      await onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit consent form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-[#632dff]/30 bg-gradient-to-br from-white to-[#f5f7ff]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Action required</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Website Subscription Terms & Conditions</h2>
          <p className="mt-2 text-sm text-slate-600">Domain available: <span className="font-semibold text-slate-950">{confirmedDomain}</span></p>
        </div>
        <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Consent needed</span>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
        {websiteSubscriptionTerms.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={submit} noValidate className="mt-5 grid gap-4 sm:grid-cols-3">
        <TextInput label="Name" value={form.name} onChange={(value) => update("name", value)} placeholder="Full name" error={fieldErrors.has("name") ? "This field is required." : ""} />
        <TextInput label="Email" value={form.email} onChange={(value) => update("email", value)} placeholder="you@example.com" type="email" error={fieldErrors.has("email") ? "This field is required." : ""} />
        <SignaturePad value={form.signature} onChange={(value) => update("signature", value)} />
        {fieldErrors.has("signature") && <p className="text-sm font-medium text-red-600 sm:col-span-3">Signature is required.</p>}
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff] disabled:opacity-60 sm:col-span-3">
          <Send className="h-4 w-4" />
          {saving ? "Submitting..." : "Accept terms and continue"}
        </button>
      </form>
    </Card>
  );
}

function ConsentFormPage() {
  const { summary, loading, load } = useCustomerData();
  const consentRequests = (summary?.requests || []).filter((item) => item.type === "domain" && item.status === "domain_available");
  const acceptedRequests = (summary?.requests || []).filter((item) => item.type === "domain" && item.status === "terms_accepted");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-[#1c5cb6] p-3 text-white">
          <Globe2 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Consent form</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-950">Website Subscription Terms</h1>
          <p className="mt-2 text-slate-600">This form appears after your domain has been confirmed as available.</p>
        </div>
      </div>

      {loading && <Card><p className="text-slate-500">Loading consent forms...</p></Card>}

      {!loading && consentRequests.length === 0 && (
        <Card>
          <h2 className="text-xl font-bold text-slate-950">No pending consent form</h2>
          <p className="mt-2 text-slate-600">When we confirm your selected domain is available, the consent form will appear here.</p>
          {acceptedRequests.length > 0 && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {acceptedRequests.length} consent form{acceptedRequests.length === 1 ? "" : "s"} already accepted.
            </div>
          )}
        </Card>
      )}

      {consentRequests.map((request) => (
        <TermsConsentCard key={request._id} request={request} onSubmitted={load} />
      ))}
    </div>
  );
}

function Packages() {
  const { summary, load } = useCustomerData();
  const [saving, setSaving] = useState("");
  const [activeCategory, setActiveCategory] = useState(customerPackages[0].category);
  const [billingByPackage, setBillingByPackage] = useState({});
  const selected = normalizeSelectedPackages(summary?.selectedPackages);
  const activeGroup = customerPackages.find((group) => group.category === activeCategory) || customerPackages[0];

  const togglePackage = async (item) => {
    const existing = findSelectedPackage(selected, item.id);
    const selectedCycle = billingByPackage[item.id] || getSelectedPackageBillingCycle(existing) || (item.annual ? "monthly" : "one_time");
    const billingCycle = item.annual ? selectedCycle : "one_time";
    const price = billingCycle === "annual" ? item.annual : item.monthly;

    setSaving(item.id);
    const next = existing
      ? selected.filter((selectedItem) => getSelectedPackageId(selectedItem) !== item.id)
      : [
          ...selected,
          {
            packageId: item.id,
            billingCycle,
            price,
            selectedAt: new Date().toISOString(),
          },
        ];
    try {
      const { data } = await API.put("/customer/packages", { selectedPackages: next });
      const currentUser = getStoredUser();
      if (currentUser && data.user?._id === currentUser._id) {
        saveAuthSession(getStoredToken(), { ...currentUser, customerProfile: data.user.customerProfile });
        window.dispatchEvent(new Event("apollo:user-updated"));
      }
      await load();
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(99,45,255,0.14),transparent_26rem),linear-gradient(135deg,#ffffff,#eef4ff)] p-6 shadow-2xl shadow-slate-200/80">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Packages</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-950">Choose a service plan</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Browse package types, compare pricing, and select the service that matches your project stage. Email Form appears when the selected package includes business email.
            </p>
          </div>
          <div className="rounded-lg border border-[#632dff]/20 bg-white px-4 py-3 text-sm font-semibold text-[#1c5cb6]">
            {selected.length} selected
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60">
        <div className="flex min-w-max gap-2">
          {customerPackages.map((group) => {
            const isActive = group.category === activeCategory;
            return (
              <button
                key={group.category}
                type="button"
                onClick={() => setActiveCategory(group.category)}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#1c5cb6] text-white shadow-lg shadow-[#632dff]/20"
                    : "text-slate-600 hover:bg-[#632dff]/5 hover:text-[#632dff]"
                }`}
              >
                {group.category}
              </button>
            );
          })}
        </div>
      </div>

      <section>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">{activeGroup.category}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeGroup.packages.length} package{activeGroup.packages.length === 1 ? "" : "s"} available in this category.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {activeGroup.packages.map((item) => {
            const selectedPackage = findSelectedPackage(selected, item.id);
            const active = Boolean(selectedPackage);
            const currentCycle = item.annual ? billingByPackage[item.id] || getSelectedPackageBillingCycle(selectedPackage) || "monthly" : "one_time";
            const currentPrice = currentCycle === "annual" ? item.annual : item.monthly;
            const includesEmail = EMAIL_PACKAGE_IDS.includes(item.id);

            return (
              <article
                key={item.id}
                className={`group flex min-h-[34rem] flex-col rounded-xl border p-5 shadow-lg shadow-slate-200/70 transition duration-200 hover:-translate-y-1 hover:border-[#bc26ff]/60 hover:bg-white hover:shadow-[#632dff]/20 ${
                  active
                    ? "border-[#632dff]/60 bg-[#632dff]/10"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="min-h-[7.5rem]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#632dff]">{activeGroup.category}</p>
                      <h3 className="mt-2 text-lg font-bold leading-6 text-slate-950">{item.title}</h3>
                    </div>
                    {active && (
                      <span className="rounded-full border border-[#632dff]/30 bg-[#632dff]/10 px-2.5 py-1 text-xs font-semibold text-[#bc26ff]">
                        {getSelectedPackageBillingCycle(selectedPackage).replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{item.description}</p>
                </div>

                {item.annual ? (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingByPackage((current) => ({ ...current, [item.id]: "monthly" }))}
                      className={`rounded-lg border p-3 text-left transition ${
                        currentCycle === "monthly"
                          ? "border-[#632dff] bg-[#632dff]/10"
                          : "border-slate-200 bg-slate-50 group-hover:border-[#632dff]/30"
                      }`}
                    >
                      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">Monthly</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{item.monthly}<span className="text-sm font-semibold text-slate-500">/month</span></p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingByPackage((current) => ({ ...current, [item.id]: "annual" }))}
                      className={`rounded-lg border p-3 text-left transition ${
                        currentCycle === "annual"
                          ? "border-[#632dff] bg-[#632dff]/10"
                          : "border-slate-200 bg-slate-50 group-hover:border-[#632dff]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">Annual</p>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-700">Save 15%</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{item.annual}<span className="text-sm font-semibold text-slate-500">/year</span></p>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-[#632dff] bg-[#632dff]/10 p-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">One Time</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{item.monthly}</p>
                  </div>
                )}

                {includesEmail && (
                  <span className="mt-4 w-fit rounded-full border border-[#1c5cb6]/30 bg-[#1c5cb6]/10 px-3 py-1 text-xs font-semibold text-[#bc26ff]">
                    Includes email setup
                  </span>
                )}

                <ul className="mt-5 flex-1 space-y-1.5">
                  {item.features.map((feature) => (
                    <li key={feature} className="border-b border-slate-200 pb-1.5 text-xs leading-5 text-slate-700 last:border-b-0">
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => togglePackage(item)}
                  disabled={saving === item.id}
                  className={`mt-5 rounded-lg px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                    active
                      ? "border border-slate-300 bg-white text-slate-700 hover:border-red-500/50 hover:text-red-600"
                    : "bg-[#1c5cb6] text-white hover:bg-[#632dff]"
                  }`}
                >
                  {saving === item.id ? "Saving..." : active ? "Remove package" : `Select ${currentCycle === "annual" ? "annual" : item.annual ? "monthly" : "package"} - ${currentPrice}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const informativeWebsiteQuestions = [
  { key: "clientName", label: "Client's Name?", type: "text" },
  { key: "projectName", label: "Project's Name?", type: "text" },
  { key: "bannerImage", label: "Do you have a banner image you'd like to use?", type: "file", guidelines:"(Allow multiple or custom placeholder if not ready)", guidelineImage: "/images/banner-info.webp" },
  { key: "mainHeadline", label: "What is your main headline or tagline for the homepage?", type: "textarea", guidelines: 'This is the big message that grabs attention (e.g., "We Build Creative Brands.")' },
  { key: "secondaryTagline", label: "What is your secondary tagline or subtext?", type: "textarea", guidelines:"Additional text to support the main headline" },
  {key:"specificbanner",label:"Do you have a specific style or image you want for the banner?", type:"textarea", guidelines:"e.g., background video, clean business image, tech background", guidelineImage: "/images/bg-video-info.webp"},
  { key: "heroStyle", label: "Homepage visual style", type: "select", options: ["Clean/Corporate", "Tech/Modern", "Minimal", "Bold/Colorful", "Custom description"] },
  { key: "heroStyleText", label: "Custom homepage visual description", type: "text", placeholder: "Background video, clean business image, tech background..." },
  { key: "companyDescription", label: "Please describe your company or business?", type: "textarea", guidelines:"Who you are, what you do, your story or mission", guidelineImage: "/images/describe-company-info.webp" },
  { key: "teamPhoto", label: "Do you want to include a team photo, founder photo, or company image?", type: "file" },
  { key: "highlights", label: "Any awards, years in business, certifications you'd like to highlight?", type: "textarea" },
  { key: "services", label: "How many services do you provide? Add each service.", type: "list", itemLabel: "Service name", guidelineImage: "/images/list-of-service-info.webp" },
  { key: "serviceImages", label: "Do you have images or icons to represent each service?", type: "file", multiple: true, guidelineImage: "/images/represent-each-service-info.webp" },
  { key: "hasTestimonials", label: "Would you like to add customer reviews/testimonials?", type: "yesno", guidelineImage: "/images/testimonial-info.webp" },
  { key: "testimonials", label: "Customer reviews/testimonials", type: "testimonials", dependsOn: ["hasTestimonials", "Yes"] },
  { key: "hasProjects", label: "Would you like to showcase past work or projects?", type: "yesno" },
  { key: "projects", label: "Past work or projects", type: "projects", dependsOn: ["hasProjects", "Yes"] },
  { key: "footerBusinessName", label: "Business Name for Footer", type: "text" },
  { key: "footerEmail", label: "Business Email Address", type: "email" },
  { key: "footerPhone", label: "Phone Number for Contact", type: "text" },
  { key: "footerAddress", label: "Address (if you'd like it shown in the footer) (optional)", type: "text" },
  { key: "socialLinks", label: "Social Media Links (optional)", type: "textarea", placeholder: "Text Input", guidelines:"Add links to Facebook, Instagram, LinkedIn, etc." },
  { key: "identityImage", label: "Please upload an image that visually represents your company’s identity or vision.", type: "file", guidelineImage: "/images/identity-or-vision-info.webp" },
  { key: "identityVisualType", label: "Would you like us to use a background image, illustration, or something abstract?", type: "select", options: ["Real photo (e.g., team, workspace, in action)", "Illustration (iconic or metaphorical)", "Abstract design", "No preference"] },
  {key:"missionphilosophy", label:"Do you have a headline or phrase that represents your company's mission or philosophy? (optional)", type:"textarea",guidelines:"Example: “Empowering businesses with smart tech”" },
  { type: "heading", title: "Section 2 - About the Company (Company Story)", description: "Purpose: To collect your brand origin, purpose, and key moments." },
  { key: "foundingStory", label: "How did your company get started? Tell us about the founding story.", type: "textarea", guidelines:"Tell us about the founding story.", guidelineImage: "/images/get-started-info.webp" },
  { key: "businessInspiration", label: "What inspired you to start this business?", type: "textarea" },
  { key: "companyNameMeaning", label: "What does your company name mean or represent? (optional)", type: "textarea" },
  { key: "foundedYear", label: "What year was the company founded?", type: "text" },
  { key: "companyGrowth", label: "How has your company grown or evolved since then?", type: "textarea", placeholder: "Text Input", guidelines:"Describe milestones, team growth, services added, etc." },
  { key: "foundersToMention", label: "Are there any founders or team members you'd like us to mention?", type: "textarea", guidelines:"Include names and roles." },
  { type: "heading", title: "Section 3 - Mission & Vision", description: "Purpose: To communicate the brand's values, future goals, and purpose." },
  { key: "mission", label: "What is your company's mission?", type: "textarea", guidelines:"What are you here to do? What problem do you solve?", guidelineImage: "/images/company-mission-info.webp" },
  { key: "vision", label: "What is your vision for the future of your company?", type: "textarea", guidelines:"Long-term goals or dreams" },
  {key:"values", label:"What are your core values or principles? (optional)", type:"select", options:["Honesty", "Innovation", "Collaboration", "Others"]},
  { type: "heading", title: "Why Choose You? (Unique Selling Points)", description: "Purpose: To explain why someone should hire or trust your company." },
  { key: "differentiator", label: "What makes your company different from your competitors?", type: "textarea", guidelineImage: "/images/company-competetiors-info.webp" },
  { key: "strengths", label: "What do you do best? What are your strengths?", type: "textarea" },
  { key: "whyChooseYou", label: "Why should customers choose you over others?", type: "textarea", guidelines:"Example: affordability, expertise, speed, customer care" },
  { key: "clientSuccessExamples", label: "Can you give examples of how you've helped your clients succeed? (optional)", type: "textarea" },
  { type: "heading", title: "Third Page - Services & Showcase" , description: "Purpose: Give visual context to what the company does — either through working shots, behind-the-scenes,or service/product images." },
  { key: "servicesBanner", label: "Upload a featured banner image for the Services page.", type: "file", guidelines:"This could be a working image, action shot, tools, environment, or anything visual that reflects your services.", guidelineImage: "/images/services-banner-info.webp" },
  { key: "servicesBannerHeadline", label: "Would you like to include a headline or short title over this banner? (optional)", type: "text", guidelines:"e.g., “What We Offer”, “Solutions That Work”, “Our Professional Services”" },
  { type: "heading", title: "Section 2 - Services Information", description: "Collect detailed service descriptions, value, process, and outcomes. You want to ask smart questions that help customers go beyond just listing services — they should share the value, process, or outcome." },
  { key: "serviceDetails", label: "What are the main services you offer?", type: "list", itemLabel: "Service name" , guidelines:"list each service name" },
  { key: "serviceAudience", label: "Who is each service best suited for? (optional)", type: "textarea", guidelines:"Helps personalize the copy (e.g., startups, realtors, small businesses)" },
  { key: "serviceQuality", label: "What makes your services stand out or different?", type: "textarea", placeholder:"Add package name + features + pricing" , guidelines:"Talk about your quality, process, guarantee, or features." },
  {key:"packagesPricing", label:"Do you offer packages or pricing tiers? (Optional but useful)", type:"textarea", guidelines:"e.g., Basic, Standard, Premium"},
  { key: "serviceDocuments", label: "Upload any brochures, PDFs, service decks, or pricing guides you already have.", type: "file", multiple: true },
  { type: "heading", title: "Section 3 - Gallery / Work References", description: "Purpose: Collect visuals or references that show the quality or style of past work — or give guidance onvisual expectations." },
  { key: "galleryImages", label: " Upload any images you'd like to showcase on your website.", type: "file", multiple: true, guidelineImage: "/images/gallery-info.webp" },
  { key: "externalGalleryLinks", label: "Do you have links to external galleries or portfolios (Instagram, Behance, Google Drive, etc.)?", type: "textarea", placeholder: "Instagram, Behance, Google Drive, etc." },
  { key: "galleryStyle", label: "Are there any specific image styles, formats, or layouts you want us to use? (optional)", type: "select", options: ["Full-width gallery", "Before-after slider", "Masonry grid"], guidelines:"e.g., full-width gallery, before-after slider, masonry grid", guidelineImage: "/images/gallery-type-info.webp" },
  { type: "heading", title: "Section 4 -What Makes Working With Us Different?", description: "This is where you differentiate your client from others by helping them add depth and emotional connection to their offer." },
  { key: "trustSectionTitle", label: "Section Title Suggestion", type: "select", options: ["What Makes Working With Us Different?", "What You Can Expect From Our Services"] },
  { key: "customerLove", label: "What do customers love most about your work or services?", type: "textarea" },
  { key: "guarantees", label: "Do you offer any guarantees, promises, or commitments?", type: "textarea", guidelines:"e.g., satisfaction guarantee, fast delivery, 24/7 support", guidelineImage: "/images/guarantees-info.webp" },
  { key: "workProcess", label: "Describe your work process from start to finish. (optional)", type: "textarea", guidelines:"Helps clients know what to expect when they hire you", guidelineImage: "/images/process-info.webp" },
  { key: "experienceWords", label: "Share 3 words that describe your service experience.", type: "text", guidelines:"Helps clients know what to expect when they hire you" },
  { key: "additionalServiceVisuals", label: "Would you like to upload any other visuals, content, or links related to your services or work?", type: "textarea",},
  {
  key: "additionalServiceVisualsFiles",
  label: "Upload any other visuals related to your services or work",
  type: "file",
  multiple: true,
},
  { type: "heading", title: "Fourth Page - Contact Us Page Content" },
  { type: "heading", title: "Section 1 Contact Form Setup- Contact Us Page Content", description:"Purpose: Help your client define what fields to include in the website contact form and where form submissions should go." },
  { key: "contactSubmissionEmail", label: "What email address should the contact form submissions go to?", type: "email" },
  { key: "contactFormFields", label: "What fields would you like to include in your contact form", type: "checkbox", options: ["Full Name", "Email Address", "Phone Number", "Subject", "Message / Inquiry", "Preferred Contact Time", "Resume", "Upload File (e.g., resume, project brief)"], guidelineImage: "/images/contact-felids-info.webp" },
  {key: "reasonContact", label:"Do you want to include a dropdown or selection for the reason for contact? (Optional)", type:"yesno" , guidelines:"e.g., General Inquiry, Quote Request, Support"},
  { key: "reasonContactOption", label: "Select the reason options for the contact dropdown", type: "select", options: ["General Inquiry", "Quote Request", "Support"], dependsOn: ["reasonContact", "yes"] },
  {key:"formSubmissionMessage", label:"Do you want to show a thank you message after form submission?", type:"textarea", guidelines:"e.g., “Thanks for contacting us! We’ll get back to you shortly.”"},
  { key: "contactRedirectUrl", label: "Would you like to redirect users to another page after form submission? (optional)", type: "text", placeholder: "https://..." , guidelines:"e.g., Thank You page, booking page" },
  { type: "heading", title: "Section 2 - Google Map / Location Display", description: "Purpose: Let the customer show their physical location (office, store, workspace, etc.) on a map or through a custom address block." },
  { key: "physicalAddress", label: "What is your complete physical address you want to display?", type: "textarea", guidelines:"This will be used to embed Google Maps.", guidelineImage: "/images/map.webp" },
  { key: "displayAddressBelowMap", label: "Would you like to display this address on the contact page below the map?", type: "yesno" },
  { key: "mapPreference", label: "Would you prefer a static map image or an interactive Google Maps embed?", type: "select", options: ["Interactive Google Map", "Static Image", "No image"] },
  { key: "otherContactInfo", label: "Would you like to include other contact information in the Contact section?", type: "checkbox", options: ["Phone Number", "Email Address", "WhatsApp or Chat Link", "Business Hours"], guidelineImage: "/images/footer-info.webp" },
];

const ecommerceWebsiteQuestions = [
  { type: "heading", title: "Section 1 Home Page Content" },
  { key: "clientName", label: "Client's Name?", type: "text" },
  { key: "projectName", label: "Project's Name?", type: "text" },
  { key: "bannerImage", label: "Do you have a banner image you'd like to use?", type: "file", guidelines:"(Allow multiple or custom placeholder if not ready)", guidelineImage: "/images/banner-ecommerce.webp" },
  { key: "mainHeadline", label: "What is your main headline or tagline for the homepage?", type: "textarea", guidelines:"(e.g., We Build Creative Brands.)" },
  { key: "secondaryTagline", label: "What is your secondary tagline or subtext?", type: "textarea", guidelines:"Additional text to support the main headline" },
  { key: "businessCategory", label: "Please select the category that best describes your business.", type: "select", options: ["Fashion / Apparel", "Beauty / Personal Care", "Electronics", "Food / Beverages", "Custom description"] },
  { key: "businessCategoryCustom", label: "Custom business category description", type: "text" },
  { type: "heading", title: "Section 2 - About Us Page" },
  { key: "companyDescription", label: "Please describe your company or business?", type: "textarea", guidelines:"Who you are, what you do, your story or mission", guidelineImage: "/images/describe-company-ecommerce.webp" },
  { key: "teamPhoto", label: "Do you want to include a team photo, founder photo, or company image?", type: "file" },
  { key: "highlights", label: "Any awards, years in business, certifications you'd like to highlight?", type: "textarea" },
  { type: "heading", title: "Section 3 - Products Page" },
  { key: "products", label: "List all the products your business provides.", type: "products", guidelines:"For each product, you can include title + description + price" },
  { key: "productImages", label: "Do you have images or icons to represent each product?", type: "file", multiple: true, guidelineImage: "/images/respresent-product-ecommerce.webp" },
  { type: "heading", title: "Section 4 - REVIEWS / TESTIMONIALS (Optional)" },
  { key: "hasTestimonials", label: "Would you like to add customer reviews/testimonials?", type: "yesno", guidelineImage: "/images/testimonial-ecommerce.webp" },
  { key: "testimonials", label: "Customer reviews/testimonials", type: "testimonials", dependsOn: ["hasTestimonials", "Yes"] },
  { type: "heading", title: "Section 5 - Frequently Asked Questions" },
  { key: "hasFaqs", label: "Frequently Asked Questions?", type: "yesno", guidelineImage: "/images/FAQ-ecommerce.webp" },
  { key: "faqs", label: "Frequently Asked Questions", type: "faqs", dependsOn: ["hasFaqs", "Yes"] },
  { type: "heading", title: "Section 6 - FOOTER INFORMATION" },
  { key: "footerBusinessName", label: "Business Name for Footer", type: "text", guidelineImage: "/images/footer-ecommerce.webp" },
  { key: "footerEmail", label: "Business Email Address", type: "email" },
  { key: "footerPhone", label: "Phone Number for Contact", type: "text" },
  { key: "footerAddress", label: "Address (optional)", type: "text", placeholder:"if you'd like it shown in the footer Kindly input" },
  { key: "socialLinks", label: "Social Media Links (optional)", type: "textarea", guidelines:"Add links to Facebook, Instagram, LinkedIn, etc." },
  { type: "heading", title: "Second Page - Company Deep Dive Form", description: "Goal: To collect detailed company information for the About, Mission, Why Us, and Testimonials sections of the website." },
  { type: "heading", title: "Section 1 - Company Banner (Vision Visual)", description: "Set the tone for the About/Company page with a powerful visual." },
  { key: "identityImage", label: "Please upload an image that visually represents your Business identity or vision.", type: "file" },
  { key: "missionHeadline", label: "Do you have a headline or phrase that represents your company's mission or philosophy? (optional)", type: "text", guidelines:"Example: “Empowering businesses with smart tech”", guidelineImage: "/images/mission-philosopy-ecomm.webp" },
  { key: "identityVisualType", label: "Would you like us to use a background image, illustration, or something abstract?", type: "select", options: ["Real photo (e.g., team, workspace, in action)", "Illustration (iconic or metaphorical)", "Abstract design", "No preference"] },
  { type: "heading", title: "Section 2 - About the Company (Company Story)", description: "Purpose: Collect your brand origin, purpose, and key moments." },
  { key: "foundingStory", label: "How did your company get started?", type: "textarea",guidelines:"Tell us about the founding story.", guidelineImage: "/images/get-started-ecommerce.webp" },
  { key: "businessInspiration", label: "What inspired you to start this business?", type: "textarea" },
  { key: "businessNameMeaning", label: "What does your Business name mean or represent? (optional)", type: "textarea" },
  { key: "foundedYear", label: "What year was the company founded?", type: "text" },
  { key: "companyGrowth", label: "How has your Business grown or evolved since then?", type: "textarea", guidelines: "Describe milestones, team growth, etc." },
  { key: "foundersToMention", label: "Are there any founders or team members you'd like us to mention?", type: "textarea", guidelines: "Include names and roles." },
  { type: "heading", title: "Section 3 - Mission & Vision", description: "Purpose: To communicate the brand’s values, future goals, and purpose" },
  { key: "mission", label: "What is your company's mission?", type: "textarea", guidelines: "What are you here to do? What problem do you solve?", },
  { key: "vision", label: "What is your vision for the future of your company?", type: "textarea", guidelines: "Long-term goals or dreams." },
  { key: "coreValues", label: "What are your core values or principles? (optional)", type: "checkbox", options: ["Honesty", "Innovation", "Collaboration", "Others"] },
  { type: "heading", title: "Section 4 - Why Choose You? (Unique Selling Points)", description: "Purpose: To explain why someone should buy your product?" },
  { key: "differentiator", label: "What makes your company different from your competitors?", type: "textarea", guidelineImage: "/images/competitors-ecommerce.webp" },
  { key: "strengths", label: "What do you do best? What are your strengths?", type: "textarea" },
  { key: "whyChooseYou", label: "Why should customers choose you over others?", type: "textarea", guidelines: "Affordability, expertise, speed, customer support..." },
  { key: "customerValueExamples", label: "Can you give examples of in what ways have your products added value to your customers? (optional)", type: "textarea" },
  { type: "heading", title: "Section 5 - Testimonials / Reviews (Optional)", description: "Same reviews format from Page 1." },
  { key: "hasDeepDiveTestimonials", label: "Would you like to add reviews/testimonials?", type: "yesno" },
  { key: "deepDiveTestimonials", label: "Additional reviews/testimonials", type: "testimonials", dependsOn: ["hasDeepDiveTestimonials", "Yes"] },
  { type: "heading", title: "Third Page - Products Page" },
  { type: "heading", title: "Section 1 - Banner (Working Visual)", description: "Purpose: Give visual context to what the brand sells — through product photos, lifestyle images showing the products in use, or behind-the-scenes shots of production and packaging." },
  { key: "productsBanner", label: "Upload a featured banner image for the Products page.", type: "file", guidelines:"This could be a working image, action shot, tools, environment, or anything visual that reflects your Products.", guidelineImage: "/images/banner-for-products-ecommerce.webp" },
  { key: "productsBannerHeadline", label: "Would you like to include a headline or short title over this banner? (optional)", type: "text", guidelines: "What We Offer, Solutions That Work, Our Products..." },
  { type: "heading", title: "Section 2 - Products Information", description: "Purpose: Collect detailed, structured Product descriptions. You want to ask smart questions that help customers go beyond just listing products — they shouldshare the value, process, or outcome." },
  { key: "mainProductCategories", label: "Please mention how many main product categories you have and what they are. This will help us organize your website effectively. ?", type: "list", itemLabel: "Category name", guidelines:"List each Category name", guidelineImage: ["/images/product-categorie-ecommerce-1.webp", "/images/product-categorie-ecommerce-2.webp"] },
  { key: "productAudience", label: "Who is each product best suited for? (optional)", type: "textarea", guidelines: "Helps personalize the copy (e.g., startups, realtors, individuals)" },
  { key: "productDifference", label: "What makes your products stand out or different?", type: "textarea", guidelines: "Talk about your quality, process, guarantee, or features.", guidelineImage: "/images/product-categorie-ecommerce-2.webp" },
  { key: "productsSheet", label: "Upload full products sheet (if available).", type: "file" },
  { type: "heading", title: "Section 3 - Why Choose Us", description: "Purpose: To explain why someone should buy your product." },
  { key: "repeatWhyChooseProductPage", label: "Would you like to repeat this section on product page?", type: "yesno" },
  { type: "heading", title: "Section 4 - Frequently Asked Questions" },
  { key: "repeatFaqsProductPage", label: "Would you like to repeat same section FAQs on product page?", type: "yesno" },
  { type: "heading", title: "Section 5 - What Makes Working With Us Different?", description: "This is where you differentiate your client from others by helping them add depth and emotional connection to their offer." },
  { key: "productGuarantees", label: "Do you offer any guarantees, promises, or commitments?", type: "textarea", guidelines: "e.g., satisfaction guarantee, fast delivery, 24/7 support" },
  { key: "productExperienceWords", label: "Share 3 words that describe your Products experience.", type: "text", guidelines: "e.g., Reliable, Fast, Transparent" },
  { type: "heading", title: "Fourth Page - Contact Us Page Content" },
  { type: "heading", title: "Section 1 - Contact Form Setup", description: "Purpose: Help your client define what fields to include in the website contact form and where form submissions should go." },
  { key: "contactSubmissionEmail", label: " What email address should the contact form submissions go to?", type: "email" },
  { key: "contactFormFields", label: "What fields would you like to include in your contact form?", type: "checkbox", options: ["Full Name", "Email Address", "Phone Number", "Subject", "Message / Inquiry", "Preferred Contact Time", "Resume", "Upload File (e.g., resume, project brief)"], guidelineImage: "/images/fields-include-contact-ecommerce.webp" },
  { key: "ecommerceReasonContact", label: "Do you want to include a dropdown or selection for the reason for contact? (Optional)", type: "yesno", guidelines: "e.g., General Inquiry, Quote Request, Support" },
  { key: "ecommerceReasonContactOptions", label: "Text input for dropdown options", type: "text", placeholder: "General Inquiry, Quote Request, Support", dependsOn: ["ecommerceReasonContact", "Yes"] },
  { key: "ecommerceFormSubmissionMessage", label: "Do you want to show a thank you message after form submission?", type: "textarea", guidelines: "e.g., Thanks for contacting us! We'll get back to you shortly." },
  { key: "contactRedirectUrl", label: "Would you like to redirect users to another page after form submission? (optional)", type: "text", placeholder: "https://...", guidelines:"e.g., Thank You page, booking page" },
  { type: "heading", title: "Section 2 - Google Map / Location Display", description: "Purpose: Let the customer show their physical location (office, store, workspace, etc.) on a map or through a custom address block." },
  { key: "physicalAddress", label: "What is your complete physical address you want to display?", type: "textarea", guidelines:"This will be used to embed Google Maps.", guidelineImage: "/images/map.webp" },
  { key: "displayAddressBelowMap", label: "Would you like to display this address on the contact page below the map?", type: "yesno" },
  { key: "mapPreference", label: "Would you prefer a static map image or an interactive Google Maps embed?", type: "select", options: ["Interactive Google Map", "Static Image", "No image"] },
  { key: "ecommerceOtherContactInfo", label: "Would you like to include other contact information in the Contact section?", type: "checkbox", options: ["Phone Number", "Email Address", "WhatsApp or Chat Link", "Business Hours"], guidelineImage: "/images/footer-for-phone-email-chatlink-ecommerce.webp" },
  { type: "heading", title: "Section 3 - Shipping & Delivery Details" },
  { key: "deliveryRegions", label: "Do you offer delivery?", type: "select", options: ["UK Only", "Internationally"] },
  { key: "preferredCourier", label: "Preferred courier (if any)", type: "text" },
  { key: "processingTime", label: "Average processing time", type: "text", placeholder: "2-3 business days" },
  { key: "productDimensions", label: "Product weight or dimension details (if required)", type: "textarea" },
  { key: "freeDeliveryThreshold", label: "Free delivery threshold (if applicable)", type: "text" },
  { type: "heading", title: "Section 4 - Payment & Policies" },
  { key: "acceptedPaymentMethods", label: "Accepted Payment Methods (select all that apply):", type: "checkbox", options: ["PayPal", "Stripe", "Cash on Delivery", "Bank Account", "Other"], guidelineImage: "/images/accepted-payments-method-commerce.webp" },
  { key: "otherPaymentMethod", label: "Other payment method", type: "text", placeholder: "Enter other method", dependsOn: ["acceptedPaymentMethods", "Other"], compact: true },
  { key: "refundPolicy", label: "Refund / Return Policy Summary", type: "textarea" },
  { key: "warranty", label: "Warranty / Guarantee (if any)", type: "textarea" },
  { key: "teamUploadsStockImages", label: "Would you like our team to upload all products stock images for you?", type: "yesno" },
  { type: "heading", title: "Section 5 - Additional Notes" },
  { key: "specialRequests", label: "Any special requests or instructions?", type: "textarea" },
  { key: "additionalDocuments", label: "Upload any additional documents or images (optional)", type: "file", multiple: true },
];

const getVisibleQuestions = (questions, form) =>
  questions.filter((question) => {
    if (!question.dependsOn) return true;
    const [key, value] = question.dependsOn;
    const currentValue = form[key];
    return Array.isArray(currentValue) ? currentValue.includes(value) : currentValue === value;
  });

const hiddenWebsiteStepHeadings = new Set([
  "Section One Home Page Content",
  "Second Page - Company Deep Dive Form",
  "Third Page - Services & Showcase",
  "Third Page - Products Page",
  "Fourth Page - Contact Us Page Content",
]);

const getWebsiteSteps = (questions, form, stepKeys) => {
  const findStart = (predicate) => {
    const index = questions.findIndex(predicate);
    return index >= 0 ? index : questions.length;
  };
  const stepTwoHeadingStart = questions.findIndex(
    (question) => question.type === "heading" && question.title === "Second Page - Company Deep Dive Form"
  );
  const stepTwoStart = stepTwoHeadingStart >= 0
    ? stepTwoHeadingStart
    : findStart((question) => question.key === stepKeys.stepTwo);
  const stepThreeHeadingStart = questions.findIndex(
    (question) =>
      question.type === "heading" &&
      ["Third Page - Services & Showcase", "Third Page - Products Page"].includes(question.title)
  );
  const stepThreeStart = stepThreeHeadingStart >= 0
    ? stepThreeHeadingStart
    : findStart((question) => question.key === stepKeys.stepThree);
  const stepFourHeadingStart = questions.findIndex(
    (question) => question.type === "heading" && question.title === "Fourth Page - Contact Us Page Content"
  );
  const stepFourStart = stepFourHeadingStart >= 0
    ? stepFourHeadingStart
    : findStart((question) => question.key === stepKeys.stepFour);
  const boundaries = [
    [0, stepTwoStart],
    [stepTwoStart, stepThreeStart],
    [stepThreeStart, stepFourStart],
    [stepFourStart, questions.length],
  ];

  return boundaries.map(([start, end]) =>
    getVisibleQuestions(questions.slice(start, end), form).filter(
      (question) => !(question.type === "heading" && hiddenWebsiteStepHeadings.has(question.title))
    )
  );
};

const REQUIRED_WEBSITE_KEYS = {
  informative: new Set([
    "clientName",
    "projectName",
    "mainHeadline",
    "secondaryTagline",
    "companyDescription",
    "services",
    "footerBusinessName",
    "footerEmail",
    "footerPhone",
    "identityImage",
    "mission",
    "vision",
    "differentiator",
    "strengths",
    "whyChooseYou",
    "servicesBanner",
    "serviceDetails",
    "serviceQuality",
    "contactSubmissionEmail",
    "contactFormFields",
  ]),
  ecommerce: new Set([
    "clientName",
    "projectName",
    "mainHeadline",
    "secondaryTagline",
    "businessCategory",
    "companyDescription",
    "products",
    "footerBusinessName",
    "footerEmail",
    "footerPhone",
    "foundingStory",
    "businessInspiration",
    "foundedYear",
    "mission",
    "vision",
    "differentiator",
    "strengths",
    "whyChooseYou",
    "productsBanner",
    "mainProductCategories",
    "productDifference",
    "contactSubmissionEmail",
    "contactFormFields",
    "deliveryRegions",
    "processingTime",
    "acceptedPaymentMethods",
    "refundPolicy",
  ]),
};

const REQUIRED_LOGO_FIELDS = [
  ["clientName", "Client's Name?"],
  ["brandName", "What is your company or brand name?"],
  ["businessDescription", "Briefly describe your business or services."],
  ["targetAudience", "Who is your target audience?"],
  ["logoType", "What type of logo are you looking for?"],
  ["fontStyle", "Do you have font style preferences?"],
  ["competitors", "Who are your top competitors or similar brands?"],
  ["differentiator", "What makes your brand different from your competitors?"],
];

const hasFormValue = (value) => {
  if (Array.isArray(value)) return value.length > 0 && value.some((item) => hasFormValue(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasFormValue(item));
  return value !== undefined && value !== null && String(value).trim() !== "";
};

const firstMissingWebsiteQuestion = (questions, form, websiteType) =>
  questions.find((question) => REQUIRED_WEBSITE_KEYS[websiteType]?.has(question.key) && !hasFormValue(form[question.key]));

const firstMissingField = (fields, form) => fields.find(([key]) => !hasFormValue(form[key]));
const missingWebsiteFields = (questions, form, websiteType) =>
  new Set(
    questions
      .filter((question) => REQUIRED_WEBSITE_KEYS[websiteType]?.has(question.key) && !hasFormValue(form[question.key]))
      .map((question) => question.key)
  );

function Repeater({ label, value = [], onChange, fields, addLabel }) {
  const items = value || [];
  const updateItem = (index, key, nextValue) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: nextValue } : item));
  const addItem = () => onChange([...items, fields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {})]);
  const removeItem = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="space-y-4 sm:col-span-2">
      {label && <span className={labelClass}>{label}</span>}
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Entry {index + 1}</p>
            <button type="button" onClick={() => removeItem(index)} className="rounded-md border border-red-500/30 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100">
              Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <TextInput
              key={field.key}
              label={`${field.label}${items.length > 1 ? ` ${index + 1}` : ""}`}
              value={item[field.key] || ""}
              onChange={(nextValue) => updateItem(index, field.key, nextValue)}
              placeholder={field.placeholder || ""}
              required={false}
            />
          ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="rounded-lg border border-[#632dff]/30 bg-[#632dff]/10 px-4 py-2 text-sm font-semibold text-[#632dff] transition hover:bg-[#632dff]/15">
        {items.length ? addLabel : addLabel.replace("another", "").trim()}
      </button>
    </div>
  );
}

function ListInput({ label, value = [], onChange, itemLabel = "Item", required = false, error = "" }) {
  const items = value || [];
  const updateItem = (index, nextValue) => onChange(items.map((item, itemIndex) => itemIndex === index ? nextValue : item));
  const addItem = () => onChange([...items, ""]);
  const removeItem = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="space-y-3">
      <span className={labelClass}>{label}<RequiredMark show={required} /></span>
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input value={item} onChange={(event) => updateItem(index, event.target.value)} aria-label={`${itemLabel} ${index + 1}`} className={inputClass} />
          <button type="button" onClick={() => removeItem(index)} className="rounded-lg border border-red-500/30 bg-red-50 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-100">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="rounded-lg border border-[#632dff]/30 bg-[#632dff]/10 px-4 py-2 text-sm font-semibold text-[#632dff] transition hover:bg-[#632dff]/15">
        {items.length ? "Add another" : "Add"}
      </button>
      <FieldError message={error} />
    </div>
  );
}

function RadioOptionsInput({ label, value = "", onChange, options = [], className = "sm:col-span-2", optionsClassName = "grid gap-2 sm:grid-cols-2", required = false, error = "" }) {
  return (
    <div className={className}>
      <span className={labelClass}>{label}<RequiredMark show={required} /></span>
      <div className={optionsClassName}>
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <input type="radio" checked={value === option} onChange={() => onChange(option)} className="h-4 w-4 accent-[#632dff]" />
            {option}
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function CheckboxGroupInput({ label, value = [], onChange, options = [], required = false, error = "" }) {
  const selected = Array.isArray(value) ? value : [];
  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
      return;
    }
    onChange([...selected, option]);
  };

  return (
    <div className="sm:col-span-2">
      <span className={labelClass}>{label}<RequiredMark show={required} /></span>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => toggleOption(option)}
              className="h-4 w-4 rounded border-slate-300 accent-[#632dff]"
            />
            {option}
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function WizardQuestion({ question, form, update, required = false, error = "" }) {
  const guidelineText = question.guideline || question.guidelines || "";
  const guidelineImages = Array.isArray(question.guidelineImage)
    ? question.guidelineImage.filter(Boolean)
    : question.guidelineImage
      ? [question.guidelineImage]
      : [];
  const guidelineImageAlt = question.guidelineImageAlt || `${question.label || question.title || "Guideline"} example`;
  const withGuideline = (content, className = "") => {
    if (guidelineImages.length) {
      return (
        <div className={`${className} sm:col-span-2`}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)] lg:items-start xl:grid-cols-[minmax(0,0.95fr)_minmax(24rem,34rem)]">
            <div>
              {content}
              <Guideline text={guidelineText} />
            </div>
            <div className="space-y-3">
              {guidelineImages.map((image, imageIndex) => (
                <img
                  key={image}
                  src={image}
                  alt={guidelineImages.length > 1 ? `${guidelineImageAlt} ${imageIndex + 1}` : guidelineImageAlt}
                  className="max-h-[18rem] w-full rounded-lg border border-slate-200 object-contain"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        {content}
        <Guideline text={guidelineText} />
      </div>
    );
  };

  if (question.type === "heading") {
    return (
      <div className="rounded-xl border border-[#632dff]/20 bg-[#632dff]/5 p-5 sm:col-span-2">
        <h2 className="text-xl font-bold text-slate-950">{question.title}</h2>
        {question.description && <p className="mt-2 text-sm leading-6 text-slate-600">{question.description}</p>}
      </div>
    );
  }
  if (question.type === "textarea") return withGuideline(<TextArea label={question.label} value={form[question.key] || ""} onChange={(value) => update(question.key, value)} placeholder={question.placeholder || ""} required={required} error={error} />, "sm:col-span-2");
  if (question.type === "select") return withGuideline(<SelectInput label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} options={question.options} required={required} error={error} />);
  if (question.type === "yesno") return withGuideline(<RadioOptionsInput label={question.label} value={form[question.key] || ""} onChange={(value) => update(question.key, value)} options={["Yes", "No"]} required={required} error={error} />);
  if (question.type === "file") return withGuideline(<FileInput label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} multiple={question.multiple} required={required} error={error} />);
  if (question.type === "list") return withGuideline(<ListInput label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} itemLabel={question.itemLabel} required={required} error={error} />);
  if (question.type === "multi") return withGuideline(<RadioOptionsInput label={question.label} value={form[question.key] || ""} onChange={(value) => update(question.key, value)} options={question.options} required={required} error={error} />, "sm:col-span-2");
  if (question.type === "checkbox" || question.type === "checklist") return withGuideline(<CheckboxGroupInput label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} options={question.options} required={required} error={error} />, "sm:col-span-2");
  if (question.type === "testimonials") return withGuideline(<Repeater label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} addLabel="Add another review" fields={[{ key: "customerName", label: "Customer name" }, { key: "reviewContent", label: "Review content" }, { key: "image", label: "Optional image/photo" }]} />, "sm:col-span-2");
  if (question.type === "projects") return withGuideline(<Repeater label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} addLabel="Add another project" fields={[{ key: "images", label: "Upload images of work" }, { key: "description", label: "Describe each project or give a title" }]} />, "sm:col-span-2");
  if (question.type === "products") return withGuideline(<Repeater label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} addLabel="Add another product" fields={[{ key: "title", label: "Product title" }, { key: "description", label: "Product description" }, { key: "price", label: "Price" }, { key: "image", label: "Product image name" }]} />, "sm:col-span-2");
  if (question.type === "faqs") return withGuideline(<Repeater label={question.label} value={form[question.key]} onChange={(value) => update(question.key, value)} addLabel="Add another FAQ" fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer" }]} />, "sm:col-span-2");
  return withGuideline(
    <TextInput label={question.label} value={form[question.key] || ""} onChange={(value) => update(question.key, value)} placeholder={question.placeholder || ""} type={question.type === "email" ? "email" : "text"} required={required} error={error} />,
    question.compact ? "max-w-sm" : ""
  );
}

const informativeFooterFieldKeys = new Set([
  "footerBusinessName",
  "footerEmail",
  "footerPhone",
  "footerAddress",
  "socialLinks",
]);

function FooterInfoGuidelineGroup({ questions, form, update, requiredKeys = new Set(), errorKeys = new Set() }) {
  return (
    <div className="sm:col-span-2">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)] lg:items-center xl:grid-cols-[minmax(0,0.95fr)_minmax(24rem,34rem)]">
        <div className="grid gap-4 sm:grid-cols-2">
          {questions.map((question) => (
            <WizardQuestion
              key={question.key}
              question={question}
              form={form}
              update={update}
              required={requiredKeys.has(question.key)}
              error={errorKeys.has(question.key) ? "This field is required." : ""}
            />
          ))}
        </div>
        <div className="flex justify-center lg:justify-end">
          <img
            src="/images/footer-info.webp"
            alt="Footer section guideline example"
            className="max-h-[26rem] w-full rounded-lg border border-slate-200 object-contain"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

function WebsiteWizardForm() {
  const navigate = useNavigate();
  const wizardTopRef = useRef(null);
  const { summary, loading } = useCustomerData();
  const selectedPackages = normalizeSelectedPackages(summary?.selectedPackages);
  const selectedWebsitePackages = packages.filter((item) =>
    hasSelectedPackageId(selectedPackages, [item.id]) && [...INFORMATIVE_PACKAGE_IDS, ...ECOMMERCE_PACKAGE_IDS].includes(item.id)
  );
  const hasWebsitePackage = selectedWebsitePackages.length > 0;
  const [selectedWebsitePackageId, setSelectedWebsitePackageId] = useState("");
  const selectedWebsitePackage = selectedWebsitePackages.find((item) => item.id === selectedWebsitePackageId);
  const selectedWebsitePackageRecord = findSelectedPackage(selectedPackages, selectedWebsitePackageId);
  const websiteType = ECOMMERCE_PACKAGE_IDS.includes(selectedWebsitePackageId) ? "ecommerce" : "informative";
  const questions = websiteType === "ecommerce" ? ecommerceWebsiteQuestions : informativeWebsiteQuestions;
  const [form, setForm] = useState({});
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attemptedStepErrors, setAttemptedStepErrors] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const steps =
    websiteType === "informative"
      ? getWebsiteSteps(questions, form, { stepTwo: "identityImage", stepThree: "servicesBanner", stepFour: "contactSubmissionEmail" })
      : getWebsiteSteps(questions, form, { stepTwo: "identityImage", stepThree: "productsBanner", stepFour: "contactSubmissionEmail" });
  const currentStep = Math.min(step, steps.length - 1);
  const currentQuestions = steps[currentStep] || [];
  const currentRequiredKeys = REQUIRED_WEBSITE_KEYS[websiteType] || new Set();
  const informativeStepHeadings = [
    "Section 1 - HOME PAGE CONTENT",
    "Second Page - Company Deep Dive Form",
    "THIRD PAGE - SERVICES & SHOWCASE",
    "FOURTH PAGE - CONTACT US PAGE CONTENT",
  ];
  const ecommerceStepHeadings = [
    "",
    "Second Page - Company Deep Dive Form",
    "THIRD PAGE - PRODUCTS PAGE",
    "FOURTH PAGE - CONTACT US PAGE CONTENT",
  ];
  const stepHeading = websiteType === "informative"
    ? informativeStepHeadings[currentStep] || ""
    : ecommerceStepHeadings[currentStep] || "";
  const stepHeadingDescription =
    stepHeading === "Second Page - Company Deep Dive Form"
      ? questions.find((question) => question.title === "Second Page - Company Deep Dive Form")?.description || ""
      : stepHeading === "THIRD PAGE - SERVICES & SHOWCASE"
      ? questions.find((question) => question.title === "Third Page - Services & Showcase")?.description || ""
      : stepHeading === "THIRD PAGE - PRODUCTS PAGE"
        ? questions.find((question) => question.title === "Third Page - Products Page")?.description || ""
      : stepHeading === "FOURTH PAGE - CONTACT US PAGE CONTENT"
        ? questions.find((question) => question.title === "Fourth Page - Contact Us Page Content")?.description || ""
        : "";
  const goToStep = (nextStep) => {
    setStep(Math.max(0, Math.min(steps.length - 1, nextStep)));
    window.setTimeout(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };
  const validateCurrentStep = () => {
    const missingKeys = missingWebsiteFields(currentQuestions, form, websiteType);
    setAttemptedStepErrors(missingKeys);
    const missing = firstMissingWebsiteQuestion(currentQuestions, form, websiteType);
    if (!missing) return true;
    setError("Please complete the required fields marked below before continuing.");
    window.setTimeout(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return false;
  };
  const goToNextStep = () => {
    setMessage("");
    setError("");
    if (!validateCurrentStep()) return;
    setAttemptedStepErrors(new Set());
    goToStep(currentStep + 1);
  };

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setAttemptedStepErrors((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      if (hasFormValue(value)) next.delete(key);
      return next;
    });
  };
  const choosePackage = (packageId) => {
    const nextType = ECOMMERCE_PACKAGE_IDS.includes(packageId) ? "ecommerce" : "informative";
    setSelectedWebsitePackageId(packageId);
    setForm({ websitePackageType: nextType, selectedWebsitePackageId: packageId });
    setStep(0);
    setAttemptedStepErrors(new Set());
    window.setTimeout(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    setMessage("");
    setError("");
  };

  const submitWebsiteRequest = async () => {
    if (!validateCurrentStep()) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await API.post("/customer/requests", {
        type: "website",
        title: form.projectName || form.businessName || "Website Request",
        priority: "normal",
        details: {
          ...form,
          websitePackageType: websiteType,
          selectedWebsitePackageId,
          selectedWebsitePackageTitle: selectedWebsitePackage?.title || "",
          selectedWebsitePackageBillingCycle: selectedWebsitePackageRecord ? getSelectedPackageBillingCycle(selectedWebsitePackageRecord) : "",
          selectedWebsitePackagePrice: selectedWebsitePackageRecord?.price || "",
        },
      });
      setMessage("Website form submitted successfully.");
      setTimeout(() => navigate("/customer"), 700);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit website form");
    } finally {
      setSaving(false);
    }
  };

  if (!hasWebsitePackage) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Website form</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{loading ? "Loading your packages..." : "Select a website package first"}</h1>
          <p className="mt-3 text-slate-600">{loading ? "Checking the packages linked to your customer account." : "Choose an Informative Website or E-commerce Website package so we can show the correct form."}</p>
          <button onClick={() => navigate("/customer/packages")} className="mt-6 rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff]">
            View packages
          </button>
        </Card>
      </div>
    );
  }

  if (!selectedWebsitePackageId) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="rounded-xl bg-[#1c5cb6] p-3 text-white">
            <Globe2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Website form</p>
            <h1 className="mt-1 text-4xl font-bold text-slate-950">Select package to see the website form</h1>
            <p className="mt-2 text-slate-600">Choose one of your selected website packages. The correct form will open according to that package.</p>
          </div>
        </div>

        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            {selectedWebsitePackages.map((item) => {
              const typeLabel = INFORMATIVE_PACKAGE_IDS.includes(item.id) ? "Informative website" : "E-commerce website";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choosePackage(item.id)}
                  className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-lg shadow-slate-200/60 transition hover:-translate-y-1 hover:border-[#632dff]/50 hover:shadow-[#632dff]/15"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#632dff]">{typeLabel}</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-950">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  <span className="mt-4 inline-flex rounded-lg bg-[#1c5cb6] px-4 py-2 text-sm font-semibold text-white">
                    Open form
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div ref={wizardTopRef} className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="rounded-xl bg-[#1c5cb6] p-3 text-white">
          <Globe2 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Website form</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-950">{websiteType === "ecommerce" ? "E-commerce Website Form" : "Informative Website Form"}</h1>
          <p className="mt-2 text-slate-600">
            {selectedWebsitePackage?.title} - Complete the form in 4 clear parts. Required fields must be filled before moving ahead.
          </p>
          <button type="button" onClick={() => (window.location.href = '/customer/packages')} className="mt-3 text-sm font-semibold text-[#632dff] hover:text-[#bc26ff]">
            Change selected package
          </button>
        </div>
      </div>

      <Card>
        {message && <p className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mb-5 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(((currentStep + 1) / Math.max(1, steps.length)) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-[#632dff] transition-all" style={{ width: `${((currentStep + 1) / Math.max(1, steps.length)) * 100}%` }} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {stepHeading && (
            <div className="rounded-xl border border-[#632dff]/20 bg-[#632dff]/5 p-5 sm:col-span-2">
              <h2 className="text-xl font-bold text-slate-950">{stepHeading}</h2>
              {stepHeadingDescription && <p className="mt-2 text-sm leading-6 text-slate-600">{stepHeadingDescription}</p>}
            </div>
          )}
          {currentQuestions.map((question, index) => {
            if (websiteType === "informative" && question.key === "footerBusinessName") {
              return (
                <FooterInfoGuidelineGroup
                  key="informative-footer-guideline-group"
                  questions={currentQuestions.filter((item) => informativeFooterFieldKeys.has(item.key))}
                  form={form}
                  update={update}
                  requiredKeys={currentRequiredKeys}
                  errorKeys={attemptedStepErrors}
                />
              );
            }
            if (websiteType === "informative" && informativeFooterFieldKeys.has(question.key)) return null;
            return (
              <WizardQuestion
                key={question.key || `${question.title}-${index}`}
                question={question}
                form={form}
                update={update}
                required={currentRequiredKeys.has(question.key)}
                error={attemptedStepErrors.has(question.key) ? "This field is required." : ""}
              />
            );
          })}
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
          <button type="button" disabled={currentStep === 0} onClick={() => goToStep(currentStep - 1)} className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:border-[#632dff]/40 hover:text-[#632dff] disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>
          {currentStep < steps.length - 1 ? (
            <button type="button" onClick={goToNextStep} className="rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff]">
              Next
            </button>
          ) : (
            <button type="button" onClick={submitWebsiteRequest} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff] disabled:opacity-60">
              <Send className="h-4 w-4" />
              {saving ? "Submitting..." : "Submit website form"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function LogoForm() {
  const navigate = useNavigate();
  const { summary, loading } = useCustomerData();
  const selectedPackages = normalizeSelectedPackages(summary?.selectedPackages);
  const selectedLogoPackages = packages.filter((item) => hasSelectedPackageId(selectedPackages, [item.id]) && LOGO_PACKAGE_IDS.includes(item.id));
  const [form, setForm] = useState({
    targetAudience: "",
    fontStyle: "",
    primaryColor: { color: "#1c5cb6", code: "" },
    secondaryColors: [
      { color: "#632dff", code: "" },
      { color: "#bc26ff", code: "" },
    ],
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoErrors, setLogoErrors] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setLogoErrors((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      if (hasFormValue(value)) next.delete(key);
      return next;
    });
  };
  const updateSecondaryColor = (index, value) => {
    update(
      "secondaryColors",
      form.secondaryColors.map((item, itemIndex) => (itemIndex === index ? value : item))
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const missingFields = new Set(REQUIRED_LOGO_FIELDS.filter(([key]) => !hasFormValue(form[key])).map(([key]) => key));
    setLogoErrors(missingFields);
    const missing = firstMissingField(REQUIRED_LOGO_FIELDS, form);
    if (missing) {
      setError("Please complete the required fields marked below before submitting.");
      return;
    }
    setSaving(true);
    try {
      await API.post("/customer/requests", {
        type: "logo",
        title: form.brandName || "Logo Request",
        priority: "normal",
        details: {
          ...form,
          selectedLogoPackageIds: selectedLogoPackages.map((item) => item.id),
          selectedLogoPackageTitles: selectedLogoPackages.map((item) => item.title),
          selectedLogoPackages: selectedLogoPackages.map((item) => {
            const selectedRecord = findSelectedPackage(selectedPackages, item.id);
            return {
              packageId: item.id,
              title: item.title,
              billingCycle: selectedRecord ? getSelectedPackageBillingCycle(selectedRecord) : "",
              price: selectedRecord?.price || "",
            };
          }),
        },
      });
      setMessage("Logo form submitted successfully.");
      setTimeout(() => navigate("/customer"), 700);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit logo form");
    } finally {
      setSaving(false);
    }
  };

  if (!hasLogoPackage(selectedPackages)) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Logo form</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{loading ? "Loading your packages..." : "Select a logo-included package first"}</h1>
          <p className="mt-3 text-slate-600">{loading ? "Checking the packages linked to your customer account." : "The logo form opens for Informative Website packages and the Branding Design package."}</p>
          <button onClick={() => navigate("/customer/packages")} className="mt-6 rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff]">
            View packages
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="rounded-xl bg-[#1c5cb6] p-3 text-white">
          <Palette className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Logo form</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-950">Logo Design Questionnaire</h1>
          <p className="mt-2 text-slate-600">Share your brand direction, audience, colors, and references so the design team can start with the right context.</p>
        </div>
      </div>

      <Card>
        {message && <p className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mb-5 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Client's Name?" value={form.clientName || ""} onChange={(value) => update("clientName", value)} placeholder="Your full name" required error={logoErrors.has("clientName") ? "This field is required." : ""} />
          <TextInput label="What is your company or brand name?" value={form.brandName || ""} onChange={(value) => update("brandName", value)} placeholder="Brand name" required error={logoErrors.has("brandName") ? "This field is required." : ""} />
          <TextInput label="Do you have a tagline or slogan to include in the logo?" value={form.tagline || ""} onChange={(value) => update("tagline", value)} placeholder="Your tagline or slogan" required={false} />
          <div className="sm:col-span-2">
            <TextArea label="Briefly describe your business or services." value={form.businessDescription || ""} onChange={(value) => update("businessDescription", value)} required error={logoErrors.has("businessDescription") ? "This field is required." : ""} />
            <Guideline text="What do you offer and what should the brand communicate?" />
          </div>
          <RadioOptionsInput label="Who is your target audience?" value={form.targetAudience || ""} onChange={(value) => update("targetAudience", value)} options={["Age range", "Location", "Gender", "Industries", "General Persona"]} required error={logoErrors.has("targetAudience") ? "This field is required." : ""} />
          <div className="sm:col-span-2">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)] lg:items-center xl:grid-cols-[minmax(0,0.95fr)_minmax(24rem,34rem)]">
              <RadioOptionsInput
                label="What type of logo are you looking for?"
                value={form.logoType || ""}
                onChange={(value) => update("logoType", value)}
                className=""
                optionsClassName="grid gap-2"
                required
                error={logoErrors.has("logoType") ? "This field is required." : ""}
                options={[
                  "Wordmark (Text-based, like Google)",
                  "Lettermark (Initials, like CNN)",
                  "Brandmark (Symbol-only, like Apple)",
                  "Combination Mark (Text + Icon, like Adidas)",
                  "Emblem (Badge-style, like Starbucks)",
                  "Unsure - I'd like recommendations",
                ]}
              />
              <div className="flex justify-center">
                <img src="/images/type-of-logo.webp" alt="Logo type guideline example" className="max-h-[18rem] w-full rounded-lg border border-slate-200 object-contain" loading="lazy" />
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <TextArea label="Target audience details" value={form.targetAudienceDetails || ""} onChange={(value) => update("targetAudienceDetails", value)} placeholder="Add age range, location, gender, industries, or persona details." required={false} />
          </div>
          <RadioOptionsInput label="Do you have font style preferences?" value={form.fontStyle || ""} onChange={(value) => update("fontStyle", value)} options={["Clean", "Serif", "Script", "Geometric", "Unsure & Suggestions"]} required error={logoErrors.has("fontStyle") ? "This field is required." : ""} />
          <TextInput label="Font style notes" value={form.fontStyleNotes || ""} onChange={(value) => update("fontStyleNotes", value)} placeholder="Any specific font direction or examples?" required={false} />
          <div className="sm:col-span-2">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)] lg:items-start xl:grid-cols-[minmax(0,0.95fr)_minmax(24rem,34rem)]">
              <div className="space-y-4">
                <FileInput label="Are there logos you like? Upload references." value={form.logoReferences} onChange={(value) => update("logoReferences", value)} multiple />
                <TextInput label="Logo reference links" value={form.logoReferenceLinks || ""} onChange={(value) => update("logoReferenceLinks", value)} placeholder="https://..." required={false} />
                <Guideline text="Upload File Or Paste Links" />
              </div>
            </div>
          </div>
          <TextArea label="Why do you like those logos?" value={form.logoReferenceNotes || ""} onChange={(value) => update("logoReferenceNotes", value)} />
          <ColorInput label="Do you have a primary color preference?" value={form.primaryColor} onChange={(value) => update("primaryColor", value)} required />
          <div>
            <span className={labelClass}>Do you have secondary color preferences? Choose up to 2.</span>
            <div className="grid gap-3">
              {form.secondaryColors.map((item, index) => (
                <ColorInput key={index} label={`Secondary color ${index + 1}`} value={item} onChange={(value) => updateSecondaryColor(index, value)} required={index === 0} />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <TextArea label="Who are your top competitors or similar brands?" value={form.competitors || ""} onChange={(value) => update("competitors", value)} required error={logoErrors.has("competitors") ? "This field is required." : ""} />
            <Guideline text="Include links if possible." />
          </div>
          <div className="sm:col-span-2">
            <TextArea label="What makes your brand different from your competitors?" value={form.differentiator || ""} onChange={(value) => update("differentiator", value)} required error={logoErrors.has("differentiator") ? "This field is required." : ""} />
            <Guideline text="Tell us what makes your brand unique." />
          </div>
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff] disabled:opacity-60 sm:col-span-2">
            <Send className="h-4 w-4" />
            {saving ? "Submitting..." : "Submit logo form"}
          </button>
        </form>
      </Card>
    </div>
  );
}

function RequestForm({ type }) {
  const navigate = useNavigate();
  const configs = {
    logo: {
      title: "Logo Form",
      icon: Palette,
      fields: [
        ["brandName", "Brand name", "Apollo Studio"],
        ["industry", "Industry", "Technology, real estate, fashion..."],
        ["style", "Preferred style", "Minimal, luxury, playful, bold..."],
        ["colors", "Color preferences", "Blue, black, gold..."],
      ],
      detailLabel: "Describe your logo idea",
    },
    website: {
      title: "Website Form",
      icon: Globe2,
      fields: [
        ["businessName", "Business name", "Your company"],
        ["websiteType", "Website type", "Portfolio, ecommerce, SaaS, agency..."],
        ["pages", "Required pages", "Home, About, Services, Contact..."],
        ["referenceLinks", "Reference links", "Paste websites you like"],
      ],
      detailLabel: "Project goals and content notes",
    },
    domain: {
      title: "Domain Form",
      icon: Globe2,
      fields: [
        ["preferredDomain", "Preferred domain", "yourbrand.com"],
        ["alternatives", "Alternative names", "yourbrand.co, yourbrand.co.uk"],
        ["purpose", "Domain purpose", "Website, landing page, email..."],
      ],
      detailLabel: "Domain notes",
    },
    email: {
      title: "Email Form",
      icon: AtSign,
      fields: [
        ["domain", "Domain", "yourbrand.com"],
        ["mailboxes", "Mailbox names", "info@, sales@, support@"],
        ["users", "Team members", "Names and preferred emails"],
      ],
      detailLabel: "Email setup notes",
    },
    ticket: {
      title: "Raise Ticket",
      icon: LifeBuoy,
      fields: [
        ["subject", "Subject", "What do you need help with?"],
        ["priority", "Priority", "normal, high, urgent"],
      ],
      detailLabel: "Explain the issue",
    },
  };
  const config = configs[type];
  const Icon = config.icon;
  const [form, setForm] = useState({ notes: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      if (hasFormValue(value)) next.delete(key);
      return next;
    });
  };
  const title = form.brandName || form.businessName || form.preferredDomain || form.domain || form.subject || config.title;

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const requiredKeys = [...config.fields.map(([key]) => key), "notes"];
    const missingFields = new Set(requiredKeys.filter((key) => !hasFormValue(form[key])));
    setFieldErrors(missingFields);
    if (missingFields.size) {
      setError("Please complete the required fields marked below before submitting.");
      return;
    }
    setSaving(true);
    try {
      await API.post("/customer/requests", {
        type,
        title,
        priority: form.priority?.toLowerCase() || "normal",
        details: form,
      });
      setMessage(`${config.title} submitted successfully.`);
      setForm({ notes: "" });
      setTimeout(() => navigate("/customer"), 700);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="rounded-xl bg-[#1c5cb6] p-3 text-white">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#632dff]">Customer form</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-950">{config.title}</h1>
          <p className="mt-2 text-slate-600">Share the essentials. Your team can refine details with you through tickets.</p>
        </div>
      </div>

      <Card>
        {message && <p className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mb-5 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
          {config.fields.map(([key, label, placeholder]) => (
            <TextInput key={key} label={label} value={form[key] || ""} onChange={(value) => update(key, value)} placeholder={placeholder} error={fieldErrors.has(key) ? "This field is required." : ""} />
          ))}
          <div className="sm:col-span-2">
            <TextArea label={config.detailLabel} value={form.notes || ""} onChange={(value) => update("notes", value)} placeholder="Write requirements, links, examples, or any special instructions." error={fieldErrors.has("notes") ? "This field is required." : ""} />
          </div>
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white transition hover:bg-[#632dff] disabled:opacity-60 sm:col-span-2">
            <Send className="h-4 w-4" />
            {saving ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </Card>
    </div>
  );
}

function CustomerDashboard() {
  const { summary, loading } = useCustomerData();
  const storedUser = getStoredUser();
  const selectedPackages = normalizeSelectedPackages(
    summary?.selectedPackages || storedUser?.customerProfile?.selectedPackages || []
  );
  const canUseEmail = hasEmailPackage(selectedPackages);

  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<CustomerHome />} />
        <Route path="packages" element={<Packages />} />
        <Route path="logo" element={<LogoForm />} />
        <Route path="website" element={<WebsiteWizardForm />} />
        <Route path="domain" element={<RequestForm type="domain" />} />
        <Route path="consent" element={<ConsentFormPage />} />
        <Route path="email" element={loading ? <Card><p className="text-slate-500">Checking your selected packages...</p></Card> : canUseEmail ? <RequestForm type="email" /> : <Packages />} />
        <Route path="tickets" element={<RequestForm type="ticket" />} />
      </Routes>
    </DashboardLayout>
  );
}

export default CustomerDashboard;
