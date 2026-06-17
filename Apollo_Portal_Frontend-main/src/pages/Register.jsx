import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Lock, Mail, Phone, User } from "lucide-react";
import API from "../services/api";

const countryCodes = [
  ["AF", "Afghanistan", "+93"],
  ["AL", "Albania", "+355"],
  ["DZ", "Algeria", "+213"],
  ["AS", "American Samoa", "+1-684"],
  ["AD", "Andorra", "+376"],
  ["AO", "Angola", "+244"],
  ["AI", "Anguilla", "+1-264"],
  ["AG", "Antigua and Barbuda", "+1-268"],
  ["AR", "Argentina", "+54"],
  ["AM", "Armenia", "+374"],
  ["AW", "Aruba", "+297"],
  ["AU", "Australia", "+61"],
  ["AT", "Austria", "+43"],
  ["AZ", "Azerbaijan", "+994"],
  ["BS", "Bahamas", "+1-242"],
  ["BH", "Bahrain", "+973"],
  ["BD", "Bangladesh", "+880"],
  ["BB", "Barbados", "+1-246"],
  ["BY", "Belarus", "+375"],
  ["BE", "Belgium", "+32"],
  ["BZ", "Belize", "+501"],
  ["BJ", "Benin", "+229"],
  ["BM", "Bermuda", "+1-441"],
  ["BT", "Bhutan", "+975"],
  ["BO", "Bolivia", "+591"],
  ["BA", "Bosnia and Herzegovina", "+387"],
  ["BW", "Botswana", "+267"],
  ["BR", "Brazil", "+55"],
  ["BN", "Brunei", "+673"],
  ["BG", "Bulgaria", "+359"],
  ["BF", "Burkina Faso", "+226"],
  ["BI", "Burundi", "+257"],
  ["KH", "Cambodia", "+855"],
  ["CM", "Cameroon", "+237"],
  ["CA", "Canada", "+1"],
  ["CV", "Cape Verde", "+238"],
  ["KY", "Cayman Islands", "+1-345"],
  ["CF", "Central African Republic", "+236"],
  ["TD", "Chad", "+235"],
  ["CL", "Chile", "+56"],
  ["CN", "China", "+86"],
  ["CO", "Colombia", "+57"],
  ["KM", "Comoros", "+269"],
  ["CG", "Congo", "+242"],
  ["CD", "Congo DR", "+243"],
  ["CK", "Cook Islands", "+682"],
  ["CR", "Costa Rica", "+506"],
  ["CI", "Cote d'Ivoire", "+225"],
  ["HR", "Croatia", "+385"],
  ["CU", "Cuba", "+53"],
  ["CY", "Cyprus", "+357"],
  ["CZ", "Czech Republic", "+420"],
  ["DK", "Denmark", "+45"],
  ["DJ", "Djibouti", "+253"],
  ["DM", "Dominica", "+1-767"],
  ["DO", "Dominican Republic", "+1-809"],
  ["EC", "Ecuador", "+593"],
  ["EG", "Egypt", "+20"],
  ["SV", "El Salvador", "+503"],
  ["GQ", "Equatorial Guinea", "+240"],
  ["ER", "Eritrea", "+291"],
  ["EE", "Estonia", "+372"],
  ["ET", "Ethiopia", "+251"],
  ["FK", "Falkland Islands", "+500"],
  ["FO", "Faroe Islands", "+298"],
  ["FJ", "Fiji", "+679"],
  ["FI", "Finland", "+358"],
  ["FR", "France", "+33"],
  ["GF", "French Guiana", "+594"],
  ["PF", "French Polynesia", "+689"],
  ["GA", "Gabon", "+241"],
  ["GM", "Gambia", "+220"],
  ["GE", "Georgia", "+995"],
  ["DE", "Germany", "+49"],
  ["GH", "Ghana", "+233"],
  ["GI", "Gibraltar", "+350"],
  ["GR", "Greece", "+30"],
  ["GL", "Greenland", "+299"],
  ["GD", "Grenada", "+1-473"],
  ["GP", "Guadeloupe", "+590"],
  ["GU", "Guam", "+1-671"],
  ["GT", "Guatemala", "+502"],
  ["GN", "Guinea", "+224"],
  ["GW", "Guinea-Bissau", "+245"],
  ["GY", "Guyana", "+592"],
  ["HT", "Haiti", "+509"],
  ["HN", "Honduras", "+504"],
  ["HK", "Hong Kong", "+852"],
  ["HU", "Hungary", "+36"],
  ["IS", "Iceland", "+354"],
  ["IN", "India", "+91"],
  ["ID", "Indonesia", "+62"],
  ["IR", "Iran", "+98"],
  ["IQ", "Iraq", "+964"],
  ["IE", "Ireland", "+353"],
  ["IL", "Israel", "+972"],
  ["IT", "Italy", "+39"],
  ["JM", "Jamaica", "+1-876"],
  ["JP", "Japan", "+81"],
  ["JO", "Jordan", "+962"],
  ["KZ", "Kazakhstan", "+7"],
  ["KE", "Kenya", "+254"],
  ["KI", "Kiribati", "+686"],
  ["KW", "Kuwait", "+965"],
  ["KG", "Kyrgyzstan", "+996"],
  ["LA", "Laos", "+856"],
  ["LV", "Latvia", "+371"],
  ["LB", "Lebanon", "+961"],
  ["LS", "Lesotho", "+266"],
  ["LR", "Liberia", "+231"],
  ["LY", "Libya", "+218"],
  ["LI", "Liechtenstein", "+423"],
  ["LT", "Lithuania", "+370"],
  ["LU", "Luxembourg", "+352"],
  ["MO", "Macau", "+853"],
  ["MK", "North Macedonia", "+389"],
  ["MG", "Madagascar", "+261"],
  ["MW", "Malawi", "+265"],
  ["MY", "Malaysia", "+60"],
  ["MV", "Maldives", "+960"],
  ["ML", "Mali", "+223"],
  ["MT", "Malta", "+356"],
  ["MH", "Marshall Islands", "+692"],
  ["MQ", "Martinique", "+596"],
  ["MR", "Mauritania", "+222"],
  ["MU", "Mauritius", "+230"],
  ["MX", "Mexico", "+52"],
  ["FM", "Micronesia", "+691"],
  ["MD", "Moldova", "+373"],
  ["MC", "Monaco", "+377"],
  ["MN", "Mongolia", "+976"],
  ["ME", "Montenegro", "+382"],
  ["MS", "Montserrat", "+1-664"],
  ["MA", "Morocco", "+212"],
  ["MZ", "Mozambique", "+258"],
  ["MM", "Myanmar", "+95"],
  ["NA", "Namibia", "+264"],
  ["NR", "Nauru", "+674"],
  ["NP", "Nepal", "+977"],
  ["NL", "Netherlands", "+31"],
  ["NC", "New Caledonia", "+687"],
  ["NZ", "New Zealand", "+64"],
  ["NI", "Nicaragua", "+505"],
  ["NE", "Niger", "+227"],
  ["NG", "Nigeria", "+234"],
  ["NU", "Niue", "+683"],
  ["KP", "North Korea", "+850"],
  ["NO", "Norway", "+47"],
  ["OM", "Oman", "+968"],
  ["PK", "Pakistan", "+92"],
  ["PW", "Palau", "+680"],
  ["PS", "Palestine", "+970"],
  ["PA", "Panama", "+507"],
  ["PG", "Papua New Guinea", "+675"],
  ["PY", "Paraguay", "+595"],
  ["PE", "Peru", "+51"],
  ["PH", "Philippines", "+63"],
  ["PL", "Poland", "+48"],
  ["PT", "Portugal", "+351"],
  ["PR", "Puerto Rico", "+1-787"],
  ["QA", "Qatar", "+974"],
  ["RE", "Reunion", "+262"],
  ["RO", "Romania", "+40"],
  ["RU", "Russia", "+7"],
  ["RW", "Rwanda", "+250"],
  ["KN", "Saint Kitts and Nevis", "+1-869"],
  ["LC", "Saint Lucia", "+1-758"],
  ["VC", "Saint Vincent", "+1-784"],
  ["WS", "Samoa", "+685"],
  ["SM", "San Marino", "+378"],
  ["ST", "Sao Tome and Principe", "+239"],
  ["SA", "Saudi Arabia", "+966"],
  ["SN", "Senegal", "+221"],
  ["RS", "Serbia", "+381"],
  ["SC", "Seychelles", "+248"],
  ["SL", "Sierra Leone", "+232"],
  ["SG", "Singapore", "+65"],
  ["SK", "Slovakia", "+421"],
  ["SI", "Slovenia", "+386"],
  ["SB", "Solomon Islands", "+677"],
  ["SO", "Somalia", "+252"],
  ["ZA", "South Africa", "+27"],
  ["KR", "South Korea", "+82"],
  ["SS", "South Sudan", "+211"],
  ["ES", "Spain", "+34"],
  ["LK", "Sri Lanka", "+94"],
  ["SD", "Sudan", "+249"],
  ["SR", "Suriname", "+597"],
  ["SZ", "Eswatini", "+268"],
  ["SE", "Sweden", "+46"],
  ["CH", "Switzerland", "+41"],
  ["SY", "Syria", "+963"],
  ["TW", "Taiwan", "+886"],
  ["TJ", "Tajikistan", "+992"],
  ["TZ", "Tanzania", "+255"],
  ["TH", "Thailand", "+66"],
  ["TL", "Timor-Leste", "+670"],
  ["TG", "Togo", "+228"],
  ["TO", "Tonga", "+676"],
  ["TT", "Trinidad and Tobago", "+1-868"],
  ["TN", "Tunisia", "+216"],
  ["TR", "Turkey", "+90"],
  ["TM", "Turkmenistan", "+993"],
  ["TC", "Turks and Caicos", "+1-649"],
  ["TV", "Tuvalu", "+688"],
  ["UG", "Uganda", "+256"],
  ["UA", "Ukraine", "+380"],
  ["AE", "United Arab Emirates", "+971"],
  ["GB", "United Kingdom", "+44"],
  ["US", "United States", "+1"],
  ["UY", "Uruguay", "+598"],
  ["UZ", "Uzbekistan", "+998"],
  ["VU", "Vanuatu", "+678"],
  ["VA", "Vatican City", "+379"],
  ["VE", "Venezuela", "+58"],
  ["VN", "Vietnam", "+84"],
  ["VG", "British Virgin Islands", "+1-284"],
  ["VI", "U.S. Virgin Islands", "+1-340"],
  ["YE", "Yemen", "+967"],
  ["ZM", "Zambia", "+260"],
  ["ZW", "Zimbabwe", "+263"],
];

const Field = ({ icon: Icon, label, type = "text", value, onChange, placeholder, required = true }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
    <span className="relative block">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1c5cb6]" />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#632dff] focus:ring-2 focus:ring-[#632dff]/20"
        placeholder={placeholder}
        required={required}
      />
    </span>
  </label>
);

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", countryCode: "+92", companyName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await API.post("/auth/customer/register", {
        ...form,
        phone: form.phone ? `${form.countryCode} ${form.phone}` : "",
      });
      setSuccess("Account created. Please login to continue.");
      setTimeout(() => navigate("/login/customer"), 700);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(188,38,255,0.14),transparent_28rem),radial-gradient(circle_at_90%_15%,rgba(28,92,182,0.12),transparent_24rem),linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef4ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="mb-8 inline-flex items-center gap-3">
            <img src="/aqua-design-works-logo.webp" alt="Aqua Design Works" className="h-12 w-20 rounded-lg object-contain" />
            <div>
              <p className="text-2xl font-bold text-slate-950">Aqua Design Works</p>
              <p className="text-sm text-slate-500">Your project requests, packages, and support in one place.</p>
            </div>
          </div>
          <h1 className="max-w-xl text-5xl font-bold leading-tight text-slate-950">Start your project with a calmer, clearer portal.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Register once, choose the package you need, and send your website, logo, domain, or email requirements from a guided dashboard.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#632dff]">Customer registration</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">Create your account</h2>
          {error && <p className="mt-5 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {success && <p className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

          <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2">
            <Field icon={User} label="Full name" value={form.name} onChange={(value) => update("name", value)} placeholder="Your name" />
            <Field icon={Mail} label="Email" value={form.email} onChange={(value) => update("email", value)} type="email" placeholder="you@company.com" />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Phone</span>
              <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-2">
                <select
                  value={form.countryCode}
                  onChange={(event) => update("countryCode", event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-[#632dff] focus:ring-2 focus:ring-[#632dff]/20"
                >
                  {countryCodes.map(([code, name, dial]) => (
                    <option className="bg-white text-black" key={`${code}-${dial}`} value={dial}>
                      {dial} {name}
                    </option>
                  ))}
                </select>
                <span className="relative block">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1c5cb6]" />
                  <input
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#632dff] focus:ring-2 focus:ring-[#632dff]/20"
                    placeholder="300 0000000"
                  />
                </span>
              </div>
            </label>
            <Field icon={Building2} label="Company" value={form.companyName} onChange={(value) => update("companyName", value)} placeholder="Company name" required={false} />
            <div className="sm:col-span-2">
              <Field icon={Lock} label="Password" value={form.password} onChange={(value) => update("password", value)} type="password" placeholder="At least 6 characters" />
            </div>
            <button
              disabled={loading}
              className="rounded-lg bg-[#1c5cb6] px-4 py-3 font-semibold text-white shadow-lg shadow-[#632dff]/20 transition hover:bg-[#632dff] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            >
              {loading ? "Creating account..." : "Create customer account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link to="/login/customer" className="font-semibold text-[#632dff] hover:text-[#bc26ff]">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
