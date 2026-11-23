"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Minus, PackageOpen, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, Card, Dialog, ErrorBlock, FieldError, FOCUS, INPUT, Label, LoadingBlock, Notice, Toggle } from "@/components/platform/seller/ui";
import { EmptyState, NextAction } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import { uploadImage } from "@/lib/v2/image-upload";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { formatUsd, type ProductDto } from "@/lib/v2/seller-types";

type Form = { name: string; description: string; category: string; price: string; stock: string; colors: string; sizes: string; imageUrl: string; active: boolean };
type Errors = Partial<Record<"name" | "description" | "category" | "price" | "stock" | "colors" | "sizes" | "imageUrl", string>>;

const EMPTY: Form = { name: "", description: "", category: "", price: "", stock: "", colors: "", sizes: "", imageUrl: "", active: true };

const toList = (s: string) => Array.from(new Set(s.split(",").map((x) => x.trim()).filter(Boolean)));
const WHOLE = /^\d+$/;
// Mirrors ASSET_URL in lib/v2/assets.ts, which is server-only.
const UPLOADED_IMAGE = /^\/api\/assets\/ast_[A-Za-z0-9_-]{6,40}$/;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter the product name.";
  else if (f.name.trim().length > 60) e.name = "The name must be at most 60 characters.";
  if (f.description.trim().length > 300) e.description = "The description must be at most 300 characters.";
  if (f.category.trim().length > 40) e.category = "The category must be at most 40 characters.";
  const price = Number(f.price);
  if (!WHOLE.test(f.price.trim()) || price < 1 || price > 10000) e.price = "Enter the price as a whole number of US dollars from 1 to 10000.";
  const stock = Number(f.stock);
  if (!WHOLE.test(f.stock.trim()) || stock > 100000) e.stock = "Enter the stock as a whole number from 0 to 100000.";
  for (const [key, label] of [["colors", "Colours"], ["sizes", "Sizes"]] as const) {
    const items = toList(f[key]);
    if (items.length > 8 || items.some((x) => x.length > 40)) e[key] = `${label}: at most 8 items of 40 characters each.`;
  }
  const url = f.imageUrl.trim();
  if (url && !UPLOADED_IMAGE.test(url)) {
    let valid = false;
    try {
      const p = new URL(url).protocol;
      valid = p === "http:" || p === "https:";
    } catch {
      valid = false;
    }
    if (!valid) e.imageUrl = "Enter an image address that starts with http:// or https://.";
    else if (url.length > 500) e.imageUrl = "The image address must be at most 500 characters.";
  }
  return e;
}

function ImageField({ value, onChange, error, inputClass, disabled, onBusy }: { value: string; onChange: (url: string) => void; error?: string; inputClass: string; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const url = value.trim();
  const uploaded = UPLOADED_IMAGE.test(url);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    onBusy(true);
    try {
      const image = await uploadImage(file, "product");
      onChange(image.url);
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
      onBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div>
      <Label htmlFor="pd-image-file" hint="Optional. JPEG, PNG or WebP. Large photos are reduced automatically.">Image</Label>
      <div
        data-testid="product-image-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) void upload(e.dataTransfer.files[0]);
        }}
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 transition-colors motion-reduce:transition-none ${dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50"}`}
      >
        {url && !error ? (
          <ImagePreview key={url} url={url} />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200" aria-hidden="true">
            <ImageIcon className="h-7 w-7" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <input
            ref={fileInput}
            id="pd-image-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || disabled}
            onChange={(e) => void upload(e.target.files?.[0])}
            data-testid="product-image-file"
            className="sr-only"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading || disabled} data-testid="product-image-upload" className={`${BTN_GHOST} !px-3 !py-1.5`}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {uploading ? "Uploading image" : uploaded ? "Replace image" : "Upload image"}
            </button>
            {url && (
              <button type="button" onClick={() => { onChange(""); setUploadError(""); }} disabled={uploading} data-testid="product-image-remove" className={`${BTN_GHOST} !px-3 !py-1.5`}>
                <X className="h-4 w-4" aria-hidden="true" />
                Remove image
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">or drag an image here</p>
          {uploading && (
            <p role="status" data-testid="product-image-uploading" className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Preparing and uploading the image
            </p>
          )}
          {uploadError && (
            <p role="alert" data-testid="product-image-upload-error" className="text-xs text-red-600">{uploadError}</p>
          )}
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="pd-image" hint="Optional. A public link that starts with https://.">Or paste an image address</Label>
        <input
          id="pd-image"
          inputMode="url"
          value={uploaded ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={uploaded}
          aria-describedby="pd-image-error"
          aria-invalid={!!error}
          data-testid="product-image-input"
          className={inputClass}
          placeholder={uploaded ? "An uploaded image is in use" : "https://example.com/scarf.jpg"}
        />
        <FieldError id="pd-image-error" message={error} testId="product-image-error" />
      </div>
    </div>
  );
}

function Thumb({ url, name, className }: { url: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-100 via-violet-100 to-cyan-100 ${className}`}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-indigo-400">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function ImagePreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div data-testid="product-image-preview" className="mt-2 flex items-center gap-3">
      {failed ? (
        <p role="status" data-testid="product-image-preview-failed" className="text-xs text-amber-700">
          This image could not be loaded. Check the address.
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Preview of the product image" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
      )}
    </div>
  );
}

export default function InventoryManager() {
  const { data, error, loading, reload, update } = useApi<ProductDto[]>("/api/desk/products");
  const [editing, setEditing] = useState<ProductDto | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const open = (p: ProductDto | "new") => {
    setForm(
      p === "new"
        ? EMPTY
        : { name: p.name, description: p.description, category: p.category, price: String(p.priceUsd), stock: String(p.stock), colors: p.colors.join(", "), sizes: p.sizes.join(", "), imageUrl: p.imageUrl ?? "", active: p.active },
    );
    setErrors({});
    setFormError("");
    setEditing(p);
  };

  const patch = async (p: ProductDto, changes: Partial<Pick<ProductDto, "stock" | "active">>, message: string) => {
    setBusyId(p.id);
    setActionError("");
    try {
      const saved = await api<ProductDto>(`/api/desk/products/${p.id}`, { method: "PATCH", json: changes });
      update((rows) => rows.map((r) => (r.id === p.id ? saved : r)));
      setNotice(message);
    } catch (err) {
      setNotice("");
      setActionError(`${p.name}: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0 || editing === null) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      priceUsd: Number(form.price),
      stock: Number(form.stock),
      colors: toList(form.colors),
      sizes: toList(form.sizes),
      imageUrl: form.imageUrl.trim() || null,
      active: form.active,
    };
    setSaving(true);
    try {
      if (editing === "new") {
        const created = await api<ProductDto>("/api/desk/products", { method: "POST", json: payload });
        update((rows) => [created, ...rows]);
        setNotice(`"${created.name}" was added to your shop.`);
      } else {
        const id = editing.id;
        const saved = await api<ProductDto>(`/api/desk/products/${id}`, { method: "PATCH", json: payload });
        update((rows) => rows.map((r) => (r.id === id ? saved : r)));
        setNotice(`"${saved.name}" was saved.`);
      }
      setActionError("");
      setEditing(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: ProductDto) => {
    setBusyId(p.id);
    setActionError("");
    try {
      await api(`/api/desk/products/${p.id}`, { method: "DELETE" });
      update((rows) => rows.filter((r) => r.id !== p.id));
      setConfirmId(null);
      setNotice(`"${p.name}" was deleted.`);
    } catch (err) {
      setNotice("");
      setActionError(`${p.name}: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const low = data?.filter((r) => r.active && r.stock <= 5).length ?? 0;
  const fieldClass = (key: keyof Errors) => `${INPUT} ${errors[key] ? "border-red-400" : ""}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600" data-testid="inventory-summary">
          {data ? `${data.length} ${data.length === 1 ? "product" : "products"} · ${low} low or out of stock` : "\u00a0"}
        </p>
        <button type="button" onClick={() => open("new")} disabled={!data} data-testid="add-product-button" className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add product
        </button>
      </div>
      <Notice message={notice} testId="inventory-confirmation" />
      {actionError && (
        <p role="alert" data-testid="inventory-action-error" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {actionError}
        </p>
      )}

      {loading && <LoadingBlock label="Loading products" testId="inventory-loading" />}
      {error && !data && <ErrorBlock message={error} onRetry={reload} testId="inventory-error" />}
      {data && data.length === 0 && <EmptyState title="No products yet" text="Add your first product so customers and the AI know what you sell." />}
      {data && data.length > 0 && (
        <Card className="overflow-x-auto !p-0" testId="inventory-table-card">
          <table className="w-full min-w-[820px] text-left text-sm" data-testid="inventory-table">
            <caption className="sr-only">Products in your shop with price and stock</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 font-medium">Visible to customers</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((r) => {
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} data-testid={`inventory-row-${r.id}`} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb key={r.imageUrl ?? "none"} url={r.imageUrl} name={r.name} className="h-12 w-12 rounded-lg" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{r.name}</p>
                          <p className="text-xs text-slate-500">{[r.category, r.colors.join(", ")].filter(Boolean).join(" · ") || "No category or colours listed"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900" data-testid={`inventory-price-${r.id}`}>{formatUsd(r.priceUsd)}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => patch(r, { stock: r.stock - 1 }, `${r.name}: stock is now ${r.stock - 1}.`)} disabled={r.stock === 0 || busy} aria-label={`Decrease stock of ${r.name}`} data-testid={`stock-minus-${r.id}`} className={`rounded-full border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 ${FOCUS}`}>
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span data-testid={`stock-value-${r.id}`} className={`min-w-8 text-center font-semibold tabular-nums ${r.stock === 0 ? "text-red-600" : r.stock <= 5 ? "text-amber-600" : "text-slate-900"}`}>
                          {r.stock}
                        </span>
                        <button type="button" onClick={() => patch(r, { stock: r.stock + 1 }, `${r.name}: stock is now ${r.stock + 1}.`)} disabled={r.stock >= 100000 || busy} aria-label={`Increase stock of ${r.name}`} data-testid={`stock-plus-${r.id}`} className={`rounded-full border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 ${FOCUS}`}>
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      {r.stock === 0 ? (
                        <p data-testid={`out-of-stock-note-${r.id}`} className="mt-1 text-xs text-red-600">Out of stock</p>
                      ) : (
                        r.stock <= 5 && <p data-testid={`low-stock-note-${r.id}`} className="mt-1 text-xs text-amber-600">Running low</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Toggle checked={r.active} onChange={(v) => patch(r, { active: v }, v ? `${r.name} is visible to customers.` : `${r.name} is hidden from customers and the AI.`)} label={`${r.name} is visible to customers`} testId={`active-toggle-${r.id}`} />
                        <span className="text-xs text-slate-500">{r.active ? "Visible" : "Hidden"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmId === r.id ? (
                        <div className="inline-flex flex-wrap items-center justify-end gap-2" data-testid={`delete-confirm-${r.id}`}>
                          <span className="text-xs text-slate-600">Delete this product for good?</span>
                          <button type="button" onClick={() => remove(r)} disabled={busy} data-testid={`delete-yes-${r.id}`} className={`${BTN_DANGER} !px-3 !py-1.5`}>Yes, delete</button>
                          <button type="button" onClick={() => setConfirmId(null)} data-testid={`delete-cancel-${r.id}`} className={`${BTN_GHOST} !px-3 !py-1.5`}>Keep it</button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => open(r)} aria-label={`Edit ${r.name}`} data-testid={`edit-${r.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 ${FOCUS}`}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </button>
                          <button type="button" onClick={() => setConfirmId(r.id)} aria-label={`Delete ${r.name}`} data-testid={`delete-${r.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 ${FOCUS}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6">
        <NextAction title="Next: check your orders" text="New orders appear on the Orders page, ready to be packed and shipped." href="/seller/orders" cta="Go to orders" />
      </div>

      {editing !== null && (
        <Dialog
          title={editing === "new" ? "Add a product" : "Edit product"}
          description="Customers and the AI see exactly what you enter here."
          onClose={() => setEditing(null)}
          testId="product-dialog"
        >
          <form onSubmit={submit} noValidate className="space-y-3">
            <div>
              <Label htmlFor="pd-name" hint="The name customers will see. Up to 60 characters.">Product name</Label>
              <input id="pd-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-describedby="pd-name-error" aria-invalid={!!errors.name} data-testid="product-name-input" className={fieldClass("name")} placeholder="Indigo hand-dyed scarf" />
              <FieldError id="pd-name-error" message={errors.name} testId="product-name-error" />
            </div>
            <div>
              <Label htmlFor="pd-description" hint="Optional. Material, size, what makes it special.">Description</Label>
              <textarea id="pd-description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-describedby="pd-description-error pd-description-count" aria-invalid={!!errors.description} data-testid="product-description-input" className={fieldClass("description")} />
              <div className="flex justify-between">
                <FieldError id="pd-description-error" message={errors.description} testId="product-description-error" />
                <p id="pd-description-count" data-testid="product-description-count" className="mt-1 text-xs text-slate-500">{form.description.length} / 300</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="pd-price" hint="US dollars.">Price</Label>
                <input id="pd-price" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} aria-describedby="pd-price-error" aria-invalid={!!errors.price} data-testid="product-price-input" className={fieldClass("price")} placeholder="24" />
              </div>
              <div>
                <Label htmlFor="pd-stock" hint="Units on hand.">Stock</Label>
                <input id="pd-stock" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} aria-describedby="pd-stock-error" aria-invalid={!!errors.stock} data-testid="product-stock-input" className={fieldClass("stock")} placeholder="12" />
              </div>
              <div>
                <Label htmlFor="pd-category" hint="Optional.">Category</Label>
                <input id="pd-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-describedby="pd-category-error" aria-invalid={!!errors.category} data-testid="product-category-input" className={fieldClass("category")} placeholder="Scarves" />
              </div>
              <div className="col-span-3 -mt-2">
                <FieldError id="pd-price-error" message={errors.price} testId="product-price-error" />
                <FieldError id="pd-stock-error" message={errors.stock} testId="product-stock-error" />
                <FieldError id="pd-category-error" message={errors.category} testId="product-category-error" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pd-colors" hint="Separate with commas. Up to 8.">Colours</Label>
                <input id="pd-colors" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} aria-describedby="pd-colors-error" aria-invalid={!!errors.colors} data-testid="product-colors-input" className={fieldClass("colors")} placeholder="Indigo, Madder red" />
                <FieldError id="pd-colors-error" message={errors.colors} testId="product-colors-error" />
              </div>
              <div>
                <Label htmlFor="pd-sizes" hint="Separate with commas. Up to 8.">Sizes</Label>
                <input id="pd-sizes" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} aria-describedby="pd-sizes-error" aria-invalid={!!errors.sizes} data-testid="product-sizes-input" className={fieldClass("sizes")} placeholder="S, M, L" />
                <FieldError id="pd-sizes-error" message={errors.sizes} testId="product-sizes-error" />
              </div>
            </div>
            <ImageField value={form.imageUrl} onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))} error={errors.imageUrl} inputClass={fieldClass("imageUrl")} disabled={saving} onBusy={setUploading} />
            <div className="flex items-center gap-3">
              <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Visible to customers and the AI" testId="product-active-toggle" />
              <span className="text-sm text-slate-700">Visible to customers and the AI</span>
            </div>
            <div role="alert" data-testid="product-form-error" className="min-h-5 text-sm font-medium text-red-600">{formError}</div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} disabled={uploading} data-testid="product-cancel" className={BTN_GHOST}>Cancel</button>
              <button type="submit" disabled={saving || uploading} data-testid="product-submit" className={BTN_PRIMARY}>
                <PackageOpen className="h-4 w-4" aria-hidden="true" />
                {saving ? "Saving" : editing === "new" ? "Add to my shop" : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
