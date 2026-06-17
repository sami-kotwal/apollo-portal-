import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Plus, UploadCloud, X, Link as LinkIcon, Pencil, Send, Trash2 } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Input, Button, Textarea, Select, Badge, Alert, Card } from "../../components/FormComponents";
import API from "../../services/api";
import TaskCard from "../../components/TaskCard";
import DashboardAnalytics from "../../components/DashboardAnalytics";
import TaskStatusFilter, { filterTasksByStatus } from "../../components/TaskStatusFilter";
import Notifications from "../Notifications";
import { getStoredUser } from "../../utils/authStorage";
import { formatDateOnly } from "../../utils/dateOnly";

const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active Clients" },
  { value: "retention", label: "Retention Clients" },
  { value: "payment_due", label: "Payment Due Clients" },
  { value: "upsell", label: "Upsell Opportunities" },
];

const CLIENT_STATUS_TONES = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  retention: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  payment_due: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  upsell: "border-purple-500/30 bg-purple-500/10 text-purple-300",
};

const getPackageId = (item) => (typeof item === "string" ? item : item?.packageId || item?.id || "");
const getStatusLabel = (status) => CLIENT_STATUS_OPTIONS.find((item) => item.value === status)?.label || "Active Clients";

function PMHome() {
  const user = getStoredUser();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let ignore = false;

    Promise.all([API.get("/tasks"), API.get("/users")]).then(([taskRes, userRes]) => {
      if (ignore) return;
      setTasks(taskRes.data);
      setUsers(userRes.data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <DashboardAnalytics
      title={`Welcome back, ${user?.name || "PM"}`}
      subtitle="Track task creation, assignments, feedback waiting on you, active owners, and deadline risk."
      tasks={tasks}
      users={users}
      showPeople
      mode="pm"
      showMonitoringSummary
    />
  );
}

function PMClientList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await API.get("/users/customers");
      const rows = res.data || [];
      setCustomers(rows);
      setStatusDrafts(
        rows.reduce((acc, customer) => {
          acc[customer._id] = customer.clientStatus || "active";
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err.response?.data?.message || "Could not load client list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const statusCounts = useMemo(
    () =>
      CLIENT_STATUS_OPTIONS.reduce((acc, option) => {
        acc[option.value] = customers.filter((customer) => (customer.clientStatus || "active") === option.value).length;
        return acc;
      }, {}),
    [customers]
  );

  const filteredCustomers = useMemo(
    () =>
      activeFilter === "all"
        ? customers
        : customers.filter((customer) => (customer.clientStatus || "active") === activeFilter),
    [activeFilter, customers]
  );

  const saveClientStatus = async (customerId) => {
    const status = statusDrafts[customerId] || "active";
    setSavingId(customerId);
    setMessage("");
    setError("");

    try {
      await API.patch(`/users/customers/${customerId}/client-status`, { status });
      setCustomers((current) =>
        current.map((customer) =>
          customer._id === customerId
            ? {
                ...customer,
                clientStatus: status,
                customerProfile: {
                  ...(customer.customerProfile || {}),
                  clientStatus: status,
                },
              }
            : customer
        )
      );
      setMessage("Client status updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not update client status");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Client List</h1>
        <p className="text-slate-400">PM client status, selected packages, and request activity.</p>
      </div>

      {(message || error) && (
        <div
          className={`mb-5 rounded-lg border p-3 text-sm ${
            error
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CLIENT_STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setActiveFilter(option.value)}
            className={`rounded-xl border p-5 text-left transition ${
              activeFilter === option.value
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900"
            }`}
          >
            <p className="text-sm text-slate-400">{option.label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{statusCounts[option.value] || 0}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            activeFilter === "all"
              ? "border-blue-500 bg-blue-600 text-white"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/50 hover:text-white"
          }`}
        >
          All Clients
        </button>
        {CLIENT_STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setActiveFilter(option.value)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              activeFilter === option.value
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/50 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Packages</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading clients...
                  </td>
                </tr>
              )}
              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No clients found in this status.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredCustomers.map((customer) => {
                  const currentStatus = customer.clientStatus || "active";
                  const draftStatus = statusDrafts[customer._id] || currentStatus;
                  const statusChanged = draftStatus !== currentStatus;

                  return (
                    <tr key={customer._id} className="text-slate-300 transition hover:bg-slate-800/50">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-white">{customer.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{customer.email}</p>
                      </td>
                      <td className="px-4 py-4">{customer.customerProfile?.companyName || "Not added"}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${CLIENT_STATUS_TONES[currentStatus] || CLIENT_STATUS_TONES.active}`}>
                          {getStatusLabel(currentStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {customer.selectedPackages?.length ? (
                          <div className="flex max-w-xs flex-wrap gap-1.5">
                            {customer.selectedPackages.map((item, index) => {
                              const packageId = getPackageId(item);
                              const billingCycle = typeof item === "string" ? "" : item?.billingCycle || "";
                              const price = typeof item === "string" ? "" : item?.price || "";
                              return (
                                <span key={`${packageId}-${billingCycle || "legacy"}-${index}`} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200">
                                  {packageId.replaceAll("-", " ")}
                                  {billingCycle && <span className="text-blue-300"> - {billingCycle.replace("_", " ")} {price && `(${price})`}</span>}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-500">None selected</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-72 items-center gap-2">
                          <select
                            value={draftStatus}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [customer._id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                          >
                            {CLIENT_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!statusChanged || savingId === customer._id}
                            onClick={() => saveClientStatus(customer._id)}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingId === customer._id ? "Saving" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/pm/clients/${customer._id}`)}
                            className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20 hover:text-white"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PMClientDetails() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [form, setForm] = useState({
    clientStatus: "active",
    screenshotImage: "",
    callRecordingLinks: [],
  });
  const [recordingInput, setRecordingInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await API.get(`/users/customers/${clientId}`);
      const profile = res.data || {};
      setCustomer(profile);
      setForm({
        clientStatus: profile.clientStatus || "active",
        screenshotImage: profile.customerProfile?.screenshotImage || profile.customerProfile?.profileImage || "",
        callRecordingLinks: profile.customerProfile?.callRecordingLinks || [],
      });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load client profile");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be 2 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setForm((current) => ({ ...current, screenshotImage: reader.result || "" }));
    };
    reader.readAsDataURL(file);
  };

  const addRecordingLink = () => {
    const link = recordingInput.trim();
    if (!link) return;

    setForm((current) => ({
      ...current,
      callRecordingLinks: [...current.callRecordingLinks, link],
    }));
    setRecordingInput("");
  };

  const removeRecordingLink = (index) => {
    setForm((current) => ({
      ...current,
      callRecordingLinks: current.callRecordingLinks.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await API.patch(`/users/customers/${clientId}/profile`, form);
      const profile = res.data || {};
      setCustomer(profile);
      setForm({
        clientStatus: profile.clientStatus || "active",
        screenshotImage: profile.customerProfile?.screenshotImage || profile.customerProfile?.profileImage || "",
        callRecordingLinks: profile.customerProfile?.callRecordingLinks || [],
      });
      setMessage("Client profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not update client profile");
    } finally {
      setSaving(false);
    }
  };

  const profile = customer?.customerProfile || {};
  const currentStatus = form.clientStatus || "active";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/pm/clients")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Client List
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Client Profile</h1>
          <p className="text-slate-400">Full client details, screenshot upload, and call recording references.</p>
        </div>
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving || loading || !customer}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {(message || error) && (
        <div
          className={`mb-5 rounded-lg border p-3 text-sm ${
            error
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

      {loading && <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center text-slate-400">Loading client profile...</div>}

      {!loading && customer && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                  {form.screenshotImage ? (
                    <img src={form.screenshotImage} alt="Client screenshot" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">No screenshot</span>
                  )}
                </div>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 hover:text-white">
                  <UploadCloud className="h-4 w-4" />
                  Upload Screenshot
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {form.screenshotImage && (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, screenshotImage: "" }))}
                    className="mt-2 text-sm font-semibold text-slate-400 hover:text-white"
                  >
                    Remove screenshot
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{customer.name}</h2>
                  <p className="mt-1 text-slate-400">{customer.email}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${CLIENT_STATUS_TONES[currentStatus] || CLIENT_STATUS_TONES.active}`}>
                  {getStatusLabel(currentStatus)}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</p>
                  <p className="mt-2 font-semibold text-white">{profile.companyName || "Not added"}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                  <p className="mt-2 font-semibold text-white">{profile.phone || "Not added"}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered</p>
                  <p className="mt-2 font-semibold text-white">{customer.createdAt ? formatDateOnly(customer.createdAt) : "Not recorded"}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Request</p>
                  <p className="mt-2 font-semibold text-white">{customer.latestRequestAt ? formatDateOnly(customer.latestRequestAt) : "No requests"}</p>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-slate-300">Client Status</span>
                <select
                  value={form.clientStatus}
                  onChange={(event) => setForm((current) => ({ ...current, clientStatus: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                >
                  {CLIENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-xl font-bold text-white">Call Recordings</h2>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                type="url"
                value={recordingInput}
                onChange={(event) => setRecordingInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addRecordingLink())}
                placeholder="Paste call recording link"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addRecordingLink}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Add Link
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {form.callRecordingLinks.map((link, index) => (
                <div key={`${link}-${index}`} className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 md:flex-row md:items-center md:justify-between">
                  <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white">
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">{link}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => removeRecordingLink(index)}
                    className="w-fit rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {form.callRecordingLinks.length === 0 && (
                <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-center text-sm text-slate-400">
                  No call recording links attached yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-xl font-bold text-white">Packages</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {customer.selectedPackages?.length ? (
                customer.selectedPackages.map((item, index) => {
                  const packageId = getPackageId(item);
                  const billingCycle = typeof item === "string" ? "" : item?.billingCycle || "";
                  const price = typeof item === "string" ? "" : item?.price || "";
                  return (
                    <span key={`${packageId}-${index}`} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm font-semibold text-blue-200">
                      {packageId.replaceAll("-", " ")}
                      {billingCycle && <span className="text-blue-300"> - {billingCycle.replace("_", " ")} {price && `(${price})`}</span>}
                    </span>
                  );
                })
              ) : (
                <p className="text-slate-400">No packages selected.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-bold text-white">Requests</h2>
              <span className="w-fit rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300">
                {customer.totalRequests || 0} total - {customer.openRequests || 0} open
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(customer.requests || []).map((request) => (
                    <tr key={request._id} className="text-slate-300">
                      <td className="px-4 py-3 font-semibold text-white">{request.title || "Untitled request"}</td>
                      <td className="px-4 py-3 capitalize">{request.type || "request"}</td>
                      <td className="px-4 py-3 capitalize">{request.status?.replaceAll("_", " ") || "pending"}</td>
                      <td className="px-4 py-3 capitalize">{request.priority || "normal"}</td>
                      <td className="px-4 py-3">{request.createdAt ? formatDateOnly(request.createdAt) : "Not recorded"}</td>
                    </tr>
                  ))}
                  {(!customer.requests || customer.requests.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No requests found for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PMTasks() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("development");
  const [deadline, setDeadline] = useState("");
  const [services, setServices] = useState([]);
  const [media, setMedia] = useState([]);
  const [serviceInput, setServiceInput] = useState("");
  const [mediaInput, setMediaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const addService = () => {
    if (serviceInput.trim()) {
      setServices([...services, serviceInput.trim()]);
      setServiceInput("");
    }
  };

  const addMedia = () => {
    if (mediaInput.trim()) {
      setMedia([...media, mediaInput.trim()]);
      setMediaInput("");
    }
  };

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const removeMedia = (index) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const createTask = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await API.post("/tasks", {
        title,
        description,
        services,
        media,
        department,
        deadline,
      });

      setSuccess(true);
      setTitle("");
      setDescription("");
      setServices([]);
      setMedia([]);
      setDeadline("");

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Create Task</h1>
      <p className="text-slate-400 mb-8">Set up a new task for your team members</p>

      {success && (
        <Alert variant="success">
          ✨ Task created successfully! Your team will be notified.
        </Alert>
      )}

      <Card className="mt-6">
        <form onSubmit={createTask} className="space-y-6">
          {/* Title */}
          <Input
            label="Task Title"
            type="text"
            placeholder="Enter task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Description */}
          <Textarea
            label="Task Description"
            placeholder="Describe what needs to be done..."
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          {/* Department */}
          <Select
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            options={[
              { label: "Development", value: "development" },
              { label: "Design", value: "designing" },
            ]}
          />

          <Input
            label="Deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />

          {/* Services */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Services Required</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Add service (e.g., Frontend, Backend)"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
              />
              <Button type="button" onClick={addService} icon={Plus} size="md">
                Add
              </Button>
            </div>
            {services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {services.map((service, i) => (
                  <Badge key={i} variant="info">
                    <div className="flex items-center gap-2">
                      {service}
                      <button type="button" onClick={() => removeService(i)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Media */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Media / References</label>
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                placeholder="Paste media/reference link"
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addMedia())}
              />
              <Button type="button" onClick={addMedia} icon={LinkIcon} size="md">
                Add
              </Button>
            </div>
            {media.length > 0 && (
              <div className="space-y-2">
                {media.map((link, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate">
                      {link}
                    </a>
                    <button type="button" onClick={() => removeMedia(i)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button loading={loading} icon={Send} variant="primary" size="lg" className="w-full">
            Create Task
          </Button>
        </form>
      </Card>
    </div>
  );
}

function PMReview() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [comment, setComment] = useState({});

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await API.get("/tasks");
        setTasks(res.data.filter((task) => task.submission));
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };
    fetchTasks();
  }, []);

  const addComment = async (taskId) => {
    if (!comment[taskId]?.trim()) return;

    try {
      await API.post("/tasks/comment", {
        taskId,
        text: comment[taskId],
      });

      setComment({ ...comment, [taskId]: "" });

      // Refetch tasks after comment
      const fetchTasks = async () => {
        try {
          const res = await API.get("/tasks");
          setTasks(res.data.filter((task) => task.submission));
        } catch (error) {
          console.error("Error fetching tasks:", error);
        }
      };
      fetchTasks();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Work Review</h1>
      <p className="text-slate-400 mb-8">Review and provide feedback on team submissions</p>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      {filterTasksByStatus(tasks, statusFilter).length === 0 ? (
        <Card>
          <p className="text-slate-400 text-center">No tasks pending review</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filterTasksByStatus(tasks, statusFilter).map((task) => (
            <TaskCard key={task._id} task={task}>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Add your feedback..."
                  value={comment[task._id] || ""}
                  onChange={(e) => setComment({ ...comment, [task._id]: e.target.value })}
                  className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addComment(task._id))}
                />
                <Button onClick={() => addComment(task._id)} icon={Send} size="sm">
                  Send
                </Button>
              </div>
            </TaskCard>
          ))}
        </div>
      )}
    </div>
  );
}

function PMProjects() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    department: "development",
    deadline: "",
    services: "",
    media: "",
  });

  const fetchTasks = async () => {
    const res = await API.get("/tasks");
    setTasks(res.data);
  };

  useEffect(() => {
    let ignore = false;

    API.get("/tasks").then((res) => {
      if (ignore) return;
      setTasks(res.data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const deleteTask = async (taskId) => {
    const confirmed = window.confirm("Delete this task? It will no longer be visible to assigned team leaders or team members.");
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await API.delete(`/tasks/${taskId}`);
      setMessage("Task deleted successfully.");
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete task");
    }
  };

  const startEdit = (task) => {
    setEditingTaskId(task._id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      department: task.department || "development",
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : "",
      services: (task.services || []).join(", "),
      media: (task.media || []).join("\n"),
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditForm({
      title: "",
      description: "",
      department: "development",
      deadline: "",
      services: "",
      media: "",
    });
  };

  const splitList = (value) =>
    String(value || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

  const saveTask = async (taskId) => {
    setMessage("");
    setError("");

    try {
      await API.put(`/tasks/${taskId}`, {
        title: editForm.title,
        description: editForm.description,
        department: editForm.department,
        deadline: editForm.deadline,
        services: splitList(editForm.services),
        media: splitList(editForm.media),
      });
      setMessage("Task updated successfully.");
      cancelEdit();
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update task");
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Projects</h1>
      <p className="text-slate-400 mb-8">Manage all your active projects</p>

      {(message || error) && (
        <div
          className={`mb-5 rounded-lg border p-3 text-sm ${
            error
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      <div className="space-y-4">
        {filterTasksByStatus(tasks, statusFilter).map((task) => (
          <TaskCard key={task._id} task={task}>
            {editingTaskId === task._id ? (
              <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                <Input
                  label="Title"
                  value={editForm.title}
                  onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                />
                <Textarea
                  label="Description"
                  value={editForm.description}
                  onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="Department"
                    value={editForm.department}
                    onChange={(event) => setEditForm({ ...editForm, department: event.target.value })}
                    options={[
                      { value: "development", label: "Development" },
                      { value: "designing", label: "Designing" },
                    ]}
                  />
                  <Input
                    label="Deadline"
                    type="date"
                    value={editForm.deadline}
                    onChange={(event) => setEditForm({ ...editForm, deadline: event.target.value })}
                  />
                </div>
                <Input
                  label="Services"
                  value={editForm.services}
                  onChange={(event) => setEditForm({ ...editForm, services: event.target.value })}
                  placeholder="Website, Dashboard, API"
                />
                <Textarea
                  label="Media Links"
                  value={editForm.media}
                  onChange={(event) => setEditForm({ ...editForm, media: event.target.value })}
                  placeholder="One link per line"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveTask(task._id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => startEdit(task)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Task
                </button>
                <button
                  onClick={() => deleteTask(task._id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Task
                </button>
              </div>
            )}
          </TaskCard>
        ))}
      </div>
    </div>
  );
}

export default function PMDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<PMHome />} />
        <Route path="projects" element={<PMProjects />} />
        <Route path="clients" element={<PMClientList />} />
        <Route path="clients/:clientId" element={<PMClientDetails />} />
        <Route path="tasks" element={<PMTasks />} />
        <Route path="review" element={<PMReview />} />
        <Route
          path="notifications"
          element={<Notifications />}
        />
      </Routes>
    </DashboardLayout>
  );
}
