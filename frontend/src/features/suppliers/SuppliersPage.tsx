
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { AxiosError } from "axios";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "./supplierApi";

import {
  EMPTY_SUPPLIER_FORM,
  type Supplier,
  type SupplierFormValues,
} from "./types";

import "./suppliers.css";

type Notice = {
  type: "success" | "error";
  message: string;
};

type SupplierField = keyof SupplierFormValues;

type FieldConfig = {
  key: SupplierField;
  label: string;
  placeholder: string;
  required?: boolean;
  maxLength: number;
  type?: "text" | "email" | "tel";
};

const FORM_FIELDS: FieldConfig[] = [
  {
    key: "name",
    label: "Supplier name",
    placeholder: "Enter supplier name",
    required: true,
    maxLength: 200,
  },
  {
    key: "phone",
    label: "Phone number",
    placeholder: "+880...",
    maxLength: 30,
    type: "tel",
  },
  {
    key: "email",
    label: "Email address",
    placeholder: "supplier@example.com",
    maxLength: 254,
    type: "email",
  },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      return "Your session has expired. Please log in again.";
    }

    if (status === 403) {
      return "You do not have permission to perform this action.";
    }

    if (status === 404) {
      return "Supplier resource was not found.";
    }

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: { msg?: string }) => item.msg ?? "Invalid value")
        .join("; ");
    }

    if (status === 409) {
      return "This supplier conflicts with an existing record.";
    }

    if (status === 422) {
      return "Invalid supplier information. Please check the form.";
    }

    return error.message || "Request failed.";
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function getInitialValues(
  supplier: Supplier | null
): SupplierFormValues {
  if (!supplier) {
    return { ...EMPTY_SUPPLIER_FORM };
  }

  return {
    name: supplier.name,
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
  };
}

type SupplierFormProps = {
  initialValues: SupplierFormValues;
  editing: boolean;
  saving: boolean;
  error: string | null;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
};

function SupplierForm({
  initialValues,
  editing,
  saving,
  error,
  onSubmit,
  onCancel,
}: SupplierFormProps) {
  const [form, setForm] = useState<SupplierFormValues>(
    initialValues
  );

  const [validationError, setValidationError] =
    useState<string | null>(null);

  function updateField(
    field: SupplierField,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setValidationError(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const values: SupplierFormValues = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
    };

    if (!values.name) {
      setValidationError("Supplier name is required.");
      return;
    }

    if (values.name.length > 200) {
      setValidationError(
        "Supplier name cannot exceed 200 characters."
      );
      return;
    }

    if (values.phone.length > 30) {
      setValidationError(
        "Phone number cannot exceed 30 characters."
      );
      return;
    }

    if (
      values.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
    ) {
      setValidationError("Enter a valid email address.");
      return;
    }

    if (values.address.length > 500) {
      setValidationError(
        "Address cannot exceed 500 characters."
      );
      return;
    }

    await onSubmit(values);
  }

  return (
    <form
      className="supplier-form"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="supplier-form-grid">
        {FORM_FIELDS.map((field) => (
          <label
            key={field.key}
            className="supplier-form-field"
          >
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>

            <input
              type={field.type ?? "text"}
              required={field.required}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              value={form[field.key]}
              onChange={(event) =>
                updateField(field.key, event.target.value)
              }
              disabled={saving}
            />
          </label>
        ))}

        <label className="supplier-form-field supplier-form-full">
          <span>Address</span>

          <textarea
            rows={3}
            maxLength={500}
            placeholder="Enter supplier address"
            value={form.address}
            onChange={(event) =>
              updateField("address", event.target.value)
            }
            disabled={saving}
          />
        </label>
      </div>

      {(validationError || error) && (
        <div className="supplier-notice error" role="alert">
          <AlertCircle size={18} />
          <span>{validationError || error}</span>
        </div>
      )}

      <div className="supplier-form-actions">
        <button
          type="button"
          className="supplier-btn secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="supplier-btn primary"
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : editing
              ? "Save changes"
              : "Add supplier"}
        </button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);

  const [editingSupplier, setEditingSupplier] =
    useState<Supplier | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<Supplier | null>(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const records = await getSuppliers();
      setSuppliers(records);
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return suppliers;
    }

    return suppliers.filter((supplier) => {
      const searchable = [
        supplier.name,
        supplier.phone ?? "",
        supplier.email ?? "",
        supplier.address ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [suppliers, search]);

  const suppliersWithPhone = useMemo(() => {
    return suppliers.filter(
      (supplier) => Boolean(supplier.phone)
    ).length;
  }, [suppliers]);

  function openCreate() {
    setNotice(null);
    setFormError(null);
    setEditingSupplier(null);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setNotice(null);
    setFormError(null);
    setEditingSupplier(supplier);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingSupplier(null);
    setFormError(null);
  }

  async function saveSupplier(values: SupplierFormValues) {
    if (saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    const editing = editingSupplier !== null;

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, values);
      } else {
        await createSupplier(values);
      }

      setFormOpen(false);
      setEditingSupplier(null);

      setNotice({
        type: "success",
        message: editing
          ? "Supplier updated successfully."
          : "Supplier created successfully.",
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
      return;
    } finally {
      setSaving(false);
    }

    await loadSuppliers();
  }

  async function confirmDelete() {
    if (!deleteTarget || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await deleteSupplier(deleteTarget.id);

      setDeleteTarget(null);

      setNotice({
        type: "success",
        message: "Supplier deleted successfully.",
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
      return;
    } finally {
      setSaving(false);
    }

    await loadSuppliers();
  }

  return (
    <div className="suppliers-page">
      <header className="supplier-page-header">
        <div>
          <span className="supplier-eyebrow">
            PHARMACY OPERATIONS
          </span>

          <h1>Suppliers</h1>

          <p>
            Manage supplier contacts and purchasing
            relationships from one workspace.
          </p>
        </div>

        <button
          type="button"
          className="supplier-btn primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          Add supplier
        </button>
      </header>

      {notice && (
        <div
          className={`supplier-notice ${notice.type}`}
          role="status"
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertCircle size={19} />
          )}

          <span>{notice.message}</span>

          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="supplier-stats">
        <div className="supplier-stat-card">
          <div className="supplier-stat-icon">
            <Truck size={21} />
          </div>

          <div>
            <span>Loaded suppliers</span>
            <strong>
              {listError ? "—" : suppliers.length}
            </strong>
            <small>Current API page</small>
          </div>
        </div>

        <div className="supplier-stat-card">
          <div className="supplier-stat-icon purple">
            <Phone size={21} />
          </div>

          <div>
            <span>With phone numbers</span>
            <strong>
              {listError ? "—" : suppliersWithPhone}
            </strong>
            <small>Contact details available</small>
          </div>
        </div>
      </div>

      <section className="supplier-table-card">
        <div className="supplier-table-toolbar">
          <div>
            <h2>Supplier directory</h2>
            <p>
              {filteredSuppliers.length} records shown
            </p>
          </div>

          <div className="supplier-table-controls">
            <div className="supplier-search">
              <Search size={18} />

              <input
                type="search"
                placeholder="Search suppliers..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                aria-label="Search suppliers"
              />
            </div>

            <button
              type="button"
              className="supplier-btn secondary"
              onClick={() => void loadSuppliers()}
              disabled={loading}
            >
              <RefreshCw
                size={17}
                className={loading ? "supplier-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {listError ? (
          <div className="supplier-empty" role="alert">
            <AlertCircle size={34} />
            <h3>Unable to load suppliers</h3>
            <p>{listError}</p>
          </div>
        ) : loading ? (
          <div className="supplier-empty">
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="supplier-empty">
            <Building2 size={36} />

            <h3>No suppliers found</h3>

            <p>
              {search
                ? "Try another search term."
                : "Add your first supplier to get started."}
            </p>
          </div>
        ) : (
          <div className="supplier-table-scroll">
            <table className="supplier-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="supplier-name-cell">
                        <div className="supplier-row-icon">
                          <Building2 size={18} />
                        </div>

                        <strong>{supplier.name}</strong>
                      </div>
                    </td>

                    <td>
                      <div className="supplier-detail">
                        <Phone size={15} />

                        {supplier.phone ? (
                          <a href={`tel:${supplier.phone}`}>
                            {supplier.phone}
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="supplier-detail">
                        <Mail size={15} />

                        {supplier.email ? (
                          <a href={`mailto:${supplier.email}`}>
                            {supplier.email}
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="supplier-detail">
                        <MapPin size={15} />

                        <span>
                          {supplier.address || "—"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          color: supplier.is_active
                            ? "#15803d"
                            : "#b91c1c",
                          fontWeight: 700,
                        }}
                      >
                        {supplier.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="supplier-row-actions">
                        <button
                          type="button"
                          title="Edit supplier"
                          aria-label={`Edit ${supplier.name}`}
                          onClick={() => openEdit(supplier)}
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          className="danger"
                          title="Delete supplier"
                          aria-label={`Delete ${supplier.name}`}
                          onClick={() => {
                            setFormError(null);
                            setDeleteTarget(supplier);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div
          className="supplier-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            className="supplier-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
          >
            <div className="supplier-modal-header">
              <div>
                <h2 id="supplier-form-title">
                  {editingSupplier
                    ? "Edit supplier"
                    : "Add new supplier"}
                </h2>

                <p>
                  Enter supplier contact information.
                </p>
              </div>

              <button
                type="button"
                className="supplier-icon-btn"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <SupplierForm
              key={editingSupplier?.id ?? "new"}
              initialValues={getInitialValues(
                editingSupplier
              )}
              editing={Boolean(editingSupplier)}
              saving={saving}
              error={formError}
              onSubmit={saveSupplier}
              onCancel={closeForm}
            />
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="supplier-modal-backdrop">
          <section
            className="supplier-modal supplier-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="supplier-delete-title"
          >
            <div className="supplier-delete-icon">
              <Trash2 size={24} />
            </div>

            <h2 id="supplier-delete-title">
              Delete supplier?
            </h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.name}</strong>?
              Existing purchase records may restrict
              this action.
            </p>

            {formError && (
              <div
                className="supplier-notice error"
                role="alert"
              >
                <AlertCircle size={18} />
                <span>{formError}</span>
              </div>
            )}

            <div className="supplier-form-actions">
              <button
                type="button"
                className="supplier-btn secondary"
                onClick={() => {
                  if (!saving) {
                    setDeleteTarget(null);
                    setFormError(null);
                  }
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="supplier-btn danger"
                onClick={() => void confirmDelete()}
                disabled={saving}
              >
                {saving
                  ? "Deleting..."
                  : "Delete supplier"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
