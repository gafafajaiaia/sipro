import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import QuotationBreakdown from "@/components/quotations/QuotationBreakdown";
import PricingFields, { EMPTY_PRICING, pricingPayload } from "@/components/pricing/PricingFields";
import { formatIDR } from "@/utils/formatters";
import api from "@/services/apiClient";
import { DEALS, RESERVE } from "@/constants/testIds";

/**
 * ReserveDialog — reservasi langsung dengan BREAKDOWN yang sama dengan penawaran.
 *
 * Cacat yang ditutup (Fase 69): dulu dialog ini hanya meminta booking fee, sehingga deal
 * lahir tanpa add-on/diskon/termin — tidak sinkron dengan penawaran. Kini harga dihitung
 * mesin yang sama (`/quotations/simulate`) dan rinciannya tersimpan pada deal.
 */
export default function ReserveDialog({
  mode = "byLead", leadId, leadName, unitId, unitLabel, open, onOpenChange, onReserved,
}) {
  const [options, setOptions] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [addonMaster, setAddonMaster] = useState([]);
  const [choice, setChoice] = useState("");
  const [form, setForm] = useState({ ...EMPTY_PRICING, booking_fee: "" });
  const [calc, setCalc] = useState(null);
  const [error, setError] = useState("");
  const [simBusy, setSimBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoice(""); setCalc(null); setError("");
    setForm({ ...EMPTY_PRICING, booking_fee: "" });
    (async () => {
      try {
        const [o, extra] = await Promise.all([
          api.get("/quotations/options"),
          mode === "byLead" ? Promise.resolve(null) : api.get("/leads", { params: { limit: 200 } }),
        ]);
        const d = o.data.data || {};
        setSchemes(d.schemes || []); setAddonMaster(d.addons || []);
        setOptions(mode === "byLead" ? (d.units || []) : (extra?.data?.data || []));
        const fee = await api.get("/settings/effective", { params: { keys: "booking_fee.default_amount" } }).catch(() => null);
        const v = fee?.data?.data?.["booking_fee.default_amount"];
        if (v != null) setForm((f) => ({ ...f, booking_fee: String(v) }));
      } catch (e) {
        setOptions([]); setError(e?.response?.data?.detail || "Gagal memuat data master.");
      }
    })();
  }, [open, mode]);

  const unit = mode === "byLead" ? choice : unitId;
  const lead = mode === "byLead" ? leadId : choice;
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setCalc(null); };
  const setKpr = (patch) => { setForm((f) => ({ ...f, kpr: { ...f.kpr, ...patch } })); setCalc(null); };

  const simulate = async () => {
    if (!unit) { setError("Pilih unit lebih dulu."); return; }
    setSimBusy(true); setError("");
    try {
      const res = await api.post("/quotations/simulate",
        { unit_id: unit, lead_id: lead || null, ...pricingPayload(form) });
      setCalc(res.data.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Gagal menghitung simulasi.");
    } finally { setSimBusy(false); }
  };

  const submit = async () => {
    if (!unit || !lead) { toast.error("Lengkapi pilihan terlebih dahulu."); return; }
    setBusy(true); setError("");
    try {
      const res = await api.post("/deals/reserve", {
        unit_id: unit, lead_id: lead, booking_fee: Number(form.booking_fee) || 0,
        ...pricingPayload(form),
      });
      toast.success("Unit berhasil di-reserve (hold aktif) — rincian harga tersimpan.");
      onOpenChange(false);
      onReserved && onReserved(res.data.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Gagal membuat reservasi.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={RESERVE.dialog} className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Buat Reservasi (SPR)</DialogTitle>
          <DialogDescription>
            {mode === "byLead"
              ? `Pesan unit tersedia untuk lead: ${leadName || ""}`
              : `Pilih lead untuk unit: ${unitLabel || ""}`}
            {" · "}Harga, add-on, potongan, dan termin dihitung mesin yang sama dengan penawaran.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{mode === "byLead" ? "Unit Tersedia" : "Lead"}</Label>
              <Select value={choice} onValueChange={(v) => { setChoice(v); setCalc(null); }}>
                <SelectTrigger data-testid="reserve-choice-select"
                  aria-label={mode === "byLead" ? "Unit tersedia" : "Lead"}>
                  <SelectValue placeholder={mode === "byLead" ? "Pilih unit" : "Pilih lead"} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {mode === "byLead" ? `${o.code} · ${o.type} · ${formatIDR(o.price)}` : `${o.name} · ${o.phone}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mode === "byLead" && !options.length ? (
                <p className="text-xs text-muted-foreground">Tidak ada unit tersedia.</p>
              ) : null}
            </div>
            <PricingFields form={form} set={set} setKpr={setKpr} unitId={unit} leadId={lead}
              schemes={schemes} addonMaster={addonMaster} ids={RESERVE} />
            <div className="space-y-1.5">
              <Label htmlFor="fee">Booking fee (Rp) — tanda jadi, bukan bagian potongan</Label>
              <Input id="fee" type="number" data-testid={RESERVE.bookingFee} value={form.booking_fee}
                onChange={(e) => setForm((f) => ({ ...f, booking_fee: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-3">
            <Button type="button" variant="secondary" className="w-full"
              data-testid={RESERVE.simulateBtn} disabled={simBusy} onClick={simulate}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${simBusy ? "animate-spin" : ""}`} />
              Hitung rincian harga
            </Button>
            {error ? (
              <p data-testid={RESERVE.error}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}
            {calc ? <div data-testid={RESERVE.breakdown}><QuotationBreakdown calc={calc} /></div> : (
              <p className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                Tekan “Hitung rincian harga” untuk melihat harga dasar, add-on, potongan, dan
                termin sebelum unit dikunci.
              </p>
            )}
            {calc?.needs_discount_approval ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Potongan ini memerlukan persetujuan manajer — buat <b>penawaran</b> lebih dulu,
                lalu konversi menjadi reservasi setelah disetujui.
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button data-testid={DEALS.reserveSubmit} onClick={submit}
            disabled={busy || !!calc?.needs_discount_approval}>
            {busy ? "Memproses..." : "Reservasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
