import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Plus, TicketPercent, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api from "@/services/apiClient";
import { formatIDR } from "@/utils/formatters";

const NONE = "__none__";

/**
 * PricingFields — field harga BERSAMA untuk dialog penawaran dan dialog reservasi.
 *
 * Potongan tidak pernah diketik: skema diskon & promo dipilih dari aturan yang berlaku untuk
 * unit ini (`GET /pricing/options`), kupon diverifikasi server (`/pricing/coupons/validate`).
 * Angka akhir selalu hasil `POST /quotations/simulate` — satu mesin harga.
 */
export default function PricingFields({
  form, set, setKpr, unitId, leadId, schemes = [], addonMaster = [], ids, showKpr = true,
}) {
  const [rules, setRules] = useState({ discount_schemes: [], promos: [] });
  const [addonPick, setAddonPick] = useState("");
  const [coupon, setCoupon] = useState(null);

  useEffect(() => {
    setCoupon(null);
    if (!unitId) { setRules({ discount_schemes: [], promos: [] }); return; }
    api.get("/pricing/options", { params: { unit_id: unitId, lead_id: leadId || undefined } })
      .then((r) => setRules(r.data.data || { discount_schemes: [], promos: [] }))
      .catch(() => setRules({ discount_schemes: [], promos: [] }));
  }, [unitId, leadId]);

  const addAddon = () => {
    const master = addonMaster.find((a) => a.code === addonPick);
    if (!master) return;
    if (form.addons.some((a) => a.code === master.code)) {
      toast.info("Tambahan itu sudah ada di daftar."); return;
    }
    set({ addons: [...form.addons, { code: master.code, qty: 1, name: master.name }] });
    setAddonPick("");
  };

  const checkCoupon = async () => {
    const code = (form.coupon_code || "").trim();
    if (!code) { setCoupon(null); return; }
    if (!unitId) { setCoupon({ ok: false, text: "Pilih unit lebih dulu." }); return; }
    try {
      const res = await api.post("/pricing/coupons/validate",
        { code, unit_id: unitId, lead_id: leadId || null });
      const line = res.data.data?.line || {};
      setCoupon({ ok: true, text: `${res.data.data?.coupon?.name} — potongan ${formatIDR(line.amount)}` });
    } catch (e) {
      setCoupon({ ok: false, text: e?.response?.data?.detail || "Kupon tidak berlaku." });
    }
  };

  const ruleLabel = (r) => `${r.name} · ${r.kind === "percent" ? `${r.value}%` : formatIDR(r.value)}`
    + (r.requires_approval ? " · perlu persetujuan" : "");

  return (
    <>
      <div className="space-y-1.5">
        <Label>Skema pembayaran</Label>
        <Select value={form.scheme_id} onValueChange={(v) => set({ scheme_id: v })}>
          <SelectTrigger data-testid={ids.schemeSelect} aria-label="Skema pembayaran">
            <SelectValue placeholder="Pakai skema bawaan" />
          </SelectTrigger>
          <SelectContent>
            {schemes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Tambahan (add-on) dari master</Label>
        <div className="flex gap-2">
          <Select value={addonPick} onValueChange={setAddonPick}>
            <SelectTrigger data-testid={ids.addonSelect} aria-label="Tambahan add-on">
              <SelectValue placeholder={addonMaster.length ? "Pilih tambahan"
                : "Master add-on belum ada"} />
            </SelectTrigger>
            <SelectContent>
              {addonMaster.map((a) => (
                <SelectItem key={a.code} value={a.code}>{a.name} ({a.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="secondary" data-testid={ids.addonAddBtn}
            onClick={addAddon}><Plus className="h-4 w-4" /></Button>
        </div>
        {form.addons.map((a, i) => (
          <div key={a.code}
            className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 shadow-[var(--shadow-card)]">
            <span className="flex-1 text-sm">{a.name || a.code}</span>
            <Input type="number" min="0.1" step="0.1" value={a.qty}
              aria-label={`Volume tambahan ${a.name || a.code}`} className="w-24"
              onChange={(e) => {
                const next = [...form.addons];
                next[i] = { ...a, qty: e.target.value };
                set({ addons: next });
              }} />
            <Button type="button" size="sm" variant="ghost"
              aria-label={`Hapus tambahan ${a.name || a.code}`}
              onClick={() => set({ addons: form.addons.filter((x) => x.code !== a.code) })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3 space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-900">
          <TicketPercent className="h-3.5 w-3.5" /> Potongan dari aturan yang berlaku
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Skema diskon</Label>
            <Select value={form.discount_scheme_id || NONE}
              onValueChange={(v) => set({ discount_scheme_id: v === NONE ? "" : v })}
              disabled={!unitId}>
              <SelectTrigger data-testid={ids.discountSelect} aria-label="Skema diskon"
                className="bg-background">
                <SelectValue placeholder="Tanpa diskon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tanpa diskon</SelectItem>
                {rules.discount_schemes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{ruleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Promo</Label>
            <Select value={form.promo_id || NONE}
              onValueChange={(v) => set({ promo_id: v === NONE ? "" : v })} disabled={!unitId}>
              <SelectTrigger data-testid={ids.promoSelect} aria-label="Promo"
                className="bg-background">
                <SelectValue placeholder="Tanpa promo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tanpa promo</SelectItem>
                {rules.promos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{ruleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.couponInput}>Kode kupon</Label>
          <div className="flex gap-2">
            <Input id={ids.couponInput} data-testid={ids.couponInput} className="bg-background uppercase"
              value={form.coupon_code || ""} placeholder="Mis. SIPRO2026"
              onChange={(e) => { set({ coupon_code: e.target.value.toUpperCase() }); setCoupon(null); }} />
            <Button type="button" variant="secondary" data-testid={ids.couponCheckBtn}
              onClick={checkCoupon}>Cek</Button>
          </div>
          {coupon ? (
            <p data-testid={ids.couponState}
              className={`flex items-center gap-1.5 text-xs ${coupon.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {coupon.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {coupon.text}
            </p>
          ) : null}
        </div>
        {!unitId ? (
          <p className="text-xs text-muted-foreground">Pilih unit dulu untuk melihat diskon & promo yang berlaku.</p>
        ) : (!rules.discount_schemes.length && !rules.promos.length ? (
          <p className="text-xs text-muted-foreground">
            Belum ada skema diskon/promo yang berlaku untuk unit ini — atur di Pusat Konfigurasi › Harga & Promo.
          </p>
        ) : null)}
      </div>

      {showKpr ? (
        <div className="rounded-lg border bg-secondary/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Simulasi KPR (opsional)
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={ids.kprTenor}>Tenor (bulan)</Label>
              <Input id={ids.kprTenor} type="number" data-testid={ids.kprTenor}
                className="bg-background" value={form.kpr.tenor_months}
                onChange={(e) => setKpr({ tenor_months: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.kprRate}>Bunga (% / tahun)</Label>
              <Input id={ids.kprRate} type="number" step="0.1" data-testid={ids.kprRate}
                className="bg-background" value={form.kpr.annual_rate_pct}
                onChange={(e) => setKpr({ annual_rate_pct: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.kprDp}>DP (%)</Label>
              <Input id={ids.kprDp} type="number" step="0.5" data-testid={ids.kprDp}
                className="bg-background" value={form.kpr.dp_pct}
                onChange={(e) => setKpr({ dp_pct: e.target.value })} />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Dibiarkan kosong = simulasi ditulis “belum ada data” (bukan Rp 0).
          </p>
        </div>
      ) : null}
    </>
  );
}

export const pricingPayload = (form) => ({
  scheme_id: form.scheme_id || null,
  addons: form.addons.map((a) => ({ code: a.code, qty: Number(a.qty) || 1 })),
  discount_scheme_id: form.discount_scheme_id || null,
  promo_id: form.promo_id || null,
  coupon_code: (form.coupon_code || "").trim() || null,
  kpr: {
    tenor_months: form.kpr.tenor_months === "" ? null : Number(form.kpr.tenor_months),
    annual_rate_pct: form.kpr.annual_rate_pct === "" ? null : Number(form.kpr.annual_rate_pct),
    dp_pct: form.kpr.dp_pct === "" ? null : Number(form.kpr.dp_pct),
  },
});

export const EMPTY_PRICING = {
  scheme_id: "", addons: [], discount_scheme_id: "", promo_id: "", coupon_code: "",
  kpr: { tenor_months: "", annual_rate_pct: "", dp_pct: "" },
};
