
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
  CheckCircle2,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  createMedicine,
  deleteMedicine,
  getMedicines,
  updateMedicine,
} from "./medicineApi";

import {
  EMPTY_MEDICINE_FORM,
  type Medicine,
  type MedicineFormValues,
} from "./types";

import "./medicines.css";

// ============================================
// TYPES
// ============================================

type Notice = {
  type: "success" | "error";
  message: string;
};

type TextField = Exclude<
  keyof MedicineFormValues,
  "reorder_level"
>;

const TEXT_FIELDS: {
  key: TextField;
  label: string;
  maxLength: number;
  required?: boolean;
  placeholder?: string;
}[] = [
  {
    key: "sku",
    label: "SKU",
    maxLength: 80,
    required: true,
    placeholder: "MED-0001",
  },
  {
    key: "brand_name",
    label: "Brand name",
    maxLength: 200,
    required: true,
  },
  {
    key: "generic_name",
    label: "Generic name",
    maxLength: 200,
    required: true,
  },
  {
    key: "strength",
    label: "Strength",
    maxLength: 80,
    required: true,
    placeholder: "500 mg",
  },
  {
    key: "dosage_form",
    label: "Dosage form",
    maxLength: 80,
    required: true,
    placeholder: "Tablet",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    maxLength: 200,
  },
  {
    key: "barcode",
    label: "Barcode",
    maxLength: 100,
  },
  {
    key: "selling_price",
    label: "Selling price (BDT)",
    maxLength: 13,
    required: true,
    placeholder: "0.00",
  },
];

// ============================================
// ERROR HANDLING
// ============================================

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map(
          (item: {
            loc?: (string | number)[];
            msg?: string;
          }) =>
            `${
              item.loc?.join(".") ?? "Field"
            }: ${item.msg ?? "Invalid value"}`
        )
        .join("; ");
    }

    if (error.response?.status === 403) {
      return "You do not have permission to modify medicines.";
    }

    if (error.response?.status === 409) {
      return "A medicine with the same SKU or barcode may already exist.";
    }

    if (error.response?.status === 422) {
      return "Validation failed. Check required fields, price, SKU and input formats.";
    }

    return error.message || "Medicine request failed.";
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

// ============================================
// FORM VALIDATION
// ============================================

function validateForm(
  values: MedicineFormValues
): string | null {
  const required: TextField[] = [
    "sku",
    "brand_name",
    "generic_name",
    "strength",
    "dosage_form",
  ];

  for (const field of required) {
    if (!values[field].trim()) {
      return `${field.replaceAll("_", " ")} is required.`;
    }
  }

  const price = values.selling_price.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(price)) {
    return "Selling price must be a non-negative amount with up to 2 decimal places.";
  }

  if (
    price.split(".")[0].length > 10 ||
    Number(price) > 9999999999.99
  ) {
    return "Selling price exceeds the allowed maximum.";
  }

  if (
    !Number.isInteger(values.reorder_level) ||
    values.reorder_level < 0
  ) {
    return "Reorder level must be a non-negative whole number.";
  }

  return null;
}

// ============================================
// MEDICINE FORM
// ============================================

function MedicineForm({
  initialValues,
  onSubmit,
  onCancel,
  saving,
  editing,
  error,
}: {
  initialValues: MedicineFormValues;
  onSubmit: (
    values: MedicineFormValues
  ) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
  error: string | null;
}) {
  const [form, setForm] =
    useState<MedicineFormValues>(initialValues);

  const [validationError, setValidationError] =
    useState<string | null>(null);

  function changeText(
    field: TextField,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setValidationError(null);
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleaned: MedicineFormValues = {
      ...form,
      sku: form.sku.trim(),
      brand_name: form.brand_name.trim(),
      generic_name: form.generic_name.trim(),
      strength: form.strength.trim(),
      dosage_form: form.dosage_form.trim(),
      manufacturer: form.manufacturer.trim(),
      barcode: form.barcode.trim(),
      selling_price: form.selling_price.trim(),
    };

    const problem = validateForm(cleaned);

    if (problem) {
      setValidationError(problem);
      return;
    }

    await onSubmit(cleaned);
  }

  return (
    <form
      className="medicine-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="medicine-form-grid">
        {TEXT_FIELDS.map((field) => (
          <label key={field.key}>
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>

            <input
              type="text"
              inputMode={
                field.key === "selling_price"
                  ? "decimal"
                  : "text"
              }
              value={form[field.key]}
              onChange={(event) =>
                changeText(
                  field.key,
                  event.target.value
                )
              }
              maxLength={field.maxLength}
              required={field.required}
              placeholder={field.placeholder}
              disabled={saving}
            />
          </label>
        ))}

        <label>
          <span>Reorder level *</span>

          <input
            type="number"
            min={0}
            step={1}
            required
            value={form.reorder_level}
            onChange={(event) => {
              setForm((previous) => ({
                ...previous,
                reorder_level:
                  event.target.value === ""
                    ? -1
                    : Number(event.target.value),
              }));

              setValidationError(null);
            }}
            disabled={saving}
          />
        </label>
      </div>

      {(validationError || error) && (
        <div
          className="medicine-notice error"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>
            {validationError ?? error}
          </span>
        </div>
      )}

      <div className="medicine-form-actions">
        <button
          type="button"
          className="medicine-btn medicine-btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="medicine-btn medicine-btn-primary"
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : editing
              ? "Save changes"
              : "Add medicine"}
        </button>
      </div>
    </form>
  );
}

// ============================================
// MEDICINES PAGE
// ============================================

export default function MedicinesPage() {
  const [medicines, setMedicines] =
    useState<Medicine[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [listError, setListError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  const [formError, setFormError] =
    useState<string | null>(null);

  const [formOpen, setFormOpen] =
    useState(false);

  const [
    editingMedicine,
    setEditingMedicine,
  ] = useState<Medicine | null>(null);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<Medicine | null>(null);

  // ============================================
  // LOAD MEDICINES
  // ============================================

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const records = await getMedicines();
      setMedicines(records);
    } catch (error) {
      setListError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMedicines();
  }, [loadMedicines]);

  // ============================================
  // SEARCH MEDICINES
  // ============================================

  const filteredMedicines = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return medicines;
    }

    return medicines.filter((medicine) => {
      const searchable = [
        medicine.sku,
        medicine.brand_name,
        medicine.generic_name,
        medicine.manufacturer ?? "",
        medicine.barcode ?? "",
        medicine.strength,
        medicine.dosage_form,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [medicines, search]);

  // ============================================
  // CREATE / EDIT ACTIONS
  // ============================================

  function openCreate() {
    setNotice(null);
    setFormError(null);
    setEditingMedicine(null);
    setFormOpen(true);
  }

  function openEdit(medicine: Medicine) {
    setNotice(null);
    setFormError(null);
    setEditingMedicine(medicine);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingMedicine(null);
    setFormError(null);
  }

  // ============================================
  // SAVE MEDICINE
  // ============================================

  async function saveMedicine(
    values: MedicineFormValues
  ) {
    if (saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    const editing = editingMedicine !== null;

    try {
      if (editingMedicine) {
        await updateMedicine(
          editingMedicine.id,
          values
        );
      } else {
        await createMedicine(values);
      }

      setFormOpen(false);
      setEditingMedicine(null);

      setNotice({
        type: "success",
        message: editing
          ? "Medicine updated successfully."
          : "Medicine created successfully.",
      });

      await loadMedicines();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  // ============================================
  // DELETE MEDICINE
  // ============================================

  async function confirmDelete() {
    if (!deleteTarget || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await deleteMedicine(deleteTarget.id);

      setDeleteTarget(null);

      setNotice({
        type: "success",
        message: "Medicine deleted successfully.",
      });

      await loadMedicines();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  // ============================================
  // EDIT FORM INITIAL VALUES
  // ============================================

  const initialFormValues: MedicineFormValues =
    editingMedicine
      ? {
          sku: editingMedicine.sku,
          brand_name: editingMedicine.brand_name,
          generic_name: editingMedicine.generic_name,
          strength: editingMedicine.strength,
          dosage_form: editingMedicine.dosage_form,
          manufacturer:
            editingMedicine.manufacturer ?? "",
          barcode:
            editingMedicine.barcode ?? "",
          selling_price: String(
            editingMedicine.selling_price
          ),
          reorder_level:
            editingMedicine.reorder_level,
        }
      : { ...EMPTY_MEDICINE_FORM };

  // ============================================
  // PAGE UI
  // ============================================

  return (
    <div className="medicines-page">
      <div className="medicine-page-header">
        <div>
          <span className="eyebrow">
            PHARMACY CATALOG
          </span>

          <h1>Medicines</h1>

          <p>
            Manage and organize medicines in your
            pharmacy workspace.
          </p>
        </div>

        <button
          type="button"
          className="medicine-btn medicine-btn-primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          Add medicine
        </button>
      </div>

      {/* Notification */}

      {notice && (
        <div
          className={`medicine-notice ${notice.type}`}
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
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Medicine Summary */}

      <div className="medicine-summary">
        <div className="medicine-summary-icon">
          <Pill size={24} />
        </div>

        <div>
          <span>Loaded medicines</span>

          <strong>
            {listError
              ? "Unavailable"
              : medicines.length}
          </strong>

          <small>
            Current API page, not total database count.
          </small>
        </div>
      </div>

      {/* Medicine Table */}

      <section className="medicine-table-card">
        <div className="medicine-table-toolbar">
          <div>
            <h2>Medicine catalog</h2>

            <p>
              {filteredMedicines.length} records shown
            </p>
          </div>

          <div className="medicine-table-controls">
            <div className="medicine-search">
              <Search size={18} />

              <input
                type="search"
                placeholder="Search medicines, SKU, barcode..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                aria-label="Search medicines"
              />
            </div>

            <button
              type="button"
              className="medicine-btn medicine-btn-secondary"
              onClick={() => void loadMedicines()}
              disabled={loading}
            >
              <RefreshCw
                size={17}
                className={
                  loading ? "medicine-spin" : ""
                }
              />

              Refresh
            </button>
          </div>
        </div>

        {/* Table Loading / Error / Empty */}

        {listError ? (
          <div
            className="medicine-empty"
            role="alert"
          >
            <AlertCircle size={30} />

            <strong>
              Unable to load medicines
            </strong>

            <p>{listError}</p>
          </div>
        ) : loading ? (
          <div className="medicine-empty">
            Loading medicines...
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="medicine-empty">
            <Pill size={35} />

            <h3>No medicines found</h3>

            <p>
              {search
                ? "Try another search term."
                : "Your current medicine list is empty."}
            </p>
          </div>
        ) : (
          <div className="medicine-table-scroll">
            <table className="medicine-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Medicine</th>
                  <th>Generic</th>
                  <th>Strength</th>
                  <th>Dosage</th>
                  <th>Price (BDT)</th>
                  <th>Reorder</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredMedicines.map(
                  (medicine) => (
                    <tr key={medicine.id}>
                      <td>{medicine.sku}</td>

                      <td>
                        <div className="medicine-name-cell">
                          <div className="medicine-row-icon">
                            <Pill size={18} />
                          </div>

                          <strong>
                            {medicine.brand_name}
                          </strong>
                        </div>
                      </td>

                      <td>
                        {medicine.generic_name}
                      </td>

                      <td>
                        {medicine.strength}
                      </td>

                      <td>
                        {medicine.dosage_form}
                      </td>

                      <td>
                        {medicine.selling_price}
                      </td>

                      <td>
                        {medicine.reorder_level}
                      </td>

                      <td>
                        <div className="medicine-row-actions">
                          <button
                            type="button"
                            title="Edit medicine"
                            aria-label={`Edit ${medicine.brand_name}`}
                            onClick={() =>
                              openEdit(medicine)
                            }
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            className="danger"
                            title="Delete medicine"
                            aria-label={`Delete ${medicine.brand_name}`}
                            onClick={() => {
                              setFormError(null);
                              setDeleteTarget(
                                medicine
                              );
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}

      {formOpen && (
        <div
          className="medicine-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <section
            className="medicine-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="medicine-form-title"
          >
            <div className="medicine-modal-header">
              <div>
                <h2 id="medicine-form-title">
                  {editingMedicine
                    ? "Edit medicine"
                    : "Add new medicine"}
                </h2>

                <p>
                  Enter medicine catalog information.
                </p>
              </div>

              <button
                type="button"
                className="medicine-icon-btn"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <MedicineForm
              key={
                editingMedicine?.id ?? "new"
              }
              initialValues={
                initialFormValues
              }
              editing={
                Boolean(editingMedicine)
              }
              saving={saving}
              error={formError}
              onCancel={closeForm}
              onSubmit={saveMedicine}
            />
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}

      {deleteTarget && (
        <div className="medicine-modal-backdrop">
          <section
            className="medicine-modal medicine-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="medicine-delete-title"
          >
            <div className="medicine-delete-icon">
              <Trash2 size={24} />
            </div>

            <h2 id="medicine-delete-title">
              Delete medicine?
            </h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>
                {deleteTarget.brand_name}
              </strong>
              ? Inventory or purchase references
              may prevent deletion.
            </p>

            {formError && (
              <div
                className="medicine-notice error"
                role="alert"
              >
                <AlertCircle size={18} />

                <span>{formError}</span>
              </div>
            )}

            <div className="medicine-form-actions">
              <button
                type="button"
                className="medicine-btn medicine-btn-secondary"
                onClick={() =>
                  setDeleteTarget(null)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="medicine-btn medicine-btn-danger"
                onClick={() =>
                  void confirmDelete()
                }
                disabled={saving}
              >
                {saving
                  ? "Deleting..."
                  : "Delete medicine"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
