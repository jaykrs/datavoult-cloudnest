'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Printer, ArrowLeft } from 'lucide-react';

interface Invoice {
  number: string; fy: string; issuedAt: string; description: string; sacCode: string | null; days: number | null;
  placeOfSupply: string | null; taxable: number; gstRate: number; cgst: number; sgst: number; igst: number; total: number;
  totalInWords: string; hasGst: boolean;
  seller: { name: string; address: string; gstin: string | null; stateName: string | null; email: string | null; phone: string | null; footer: string | null };
  buyer: { name: string; email: string; gstin: string | null; address: string | null; stateName: string | null };
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoices/${id}`).then(async res => {
      if (res.status === 401) { router.push(`/login?next=/invoices/${id}`); return; }
      const d = await res.json();
      if (res.ok) setInv(d.data.invoice); else setError(d.error || 'Invoice not found');
      setLoading(false);
    }).catch(() => { setError('Network error'); setLoading(false); });
  }, [id, router]);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!inv) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <p>{error}</p><Link href="/billing" className="btn btn-secondary btn-sm">Back to billing</Link>
    </div>
  );

  const intra = inv.cgst > 0 || inv.sgst > 0;
  const th = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #222', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' } as const;
  const td = { padding: '10px', borderBottom: '1px solid #ddd', fontSize: 13, verticalAlign: 'top' } as const;
  const right = { textAlign: 'right' } as const;

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: #fff !important; } .invoice-sheet { box-shadow: none !important; margin: 0 !important; } @page { size: A4; margin: 14mm; } }
      `}</style>
      <div style={{ background: '#e5e7eb', minHeight: '100vh', padding: '24px 12px' }}>
        <div className="no-print" style={{ maxWidth: 820, margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between' }}>
          <Link href="/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}><ArrowLeft size={14} /> Billing</Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>
        </div>

        <div className="invoice-sheet" style={{ maxWidth: 820, margin: '0 auto', background: '#fff', color: '#111', padding: '40px 44px', boxShadow: '0 2px 18px rgba(0,0,0,0.15)', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{inv.seller.name}</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.5, marginTop: 4 }}>{inv.seller.address}</div>
              {inv.seller.gstin && <div style={{ fontSize: 13, marginTop: 4 }}><b>GSTIN:</b> {inv.seller.gstin}</div>}
              {(inv.seller.email || inv.seller.phone) && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{[inv.seller.email, inv.seller.phone].filter(Boolean).join(' · ')}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.04em' }}>{inv.hasGst ? 'TAX INVOICE' : 'INVOICE'}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}><b>No:</b> {inv.number}</div>
              <div style={{ fontSize: 13 }}><b>Date:</b> {new Date(inv.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</div>
              <div style={{ fontSize: 12, color: '#555' }}>Financial year {inv.fy}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 28, padding: '14px 0', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd' }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em' }}>Billed to</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{inv.buyer.name}</div>
              {inv.buyer.address && <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{inv.buyer.address}</div>}
              <div style={{ fontSize: 13 }}>{inv.buyer.email}</div>
              {inv.buyer.gstin && <div style={{ fontSize: 13 }}><b>GSTIN:</b> {inv.buyer.gstin}</div>}
            </div>
            {inv.placeOfSupply && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em' }}>Place of supply</div>
                <div style={{ fontSize: 14, marginTop: 2 }}>{inv.placeOfSupply}</div>
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
            <thead>
              <tr>
                <th style={th}>Description</th>
                {inv.sacCode && <th style={th}>SAC</th>}
                {inv.hasGst && <th style={{ ...th, ...right }}>Taxable value</th>}
                {inv.hasGst && <th style={{ ...th, ...right }}>GST</th>}
                <th style={{ ...th, ...right }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={td}>{inv.description}</td>
                {inv.sacCode && <td style={td}>{inv.sacCode}</td>}
                {inv.hasGst && <td style={{ ...td, ...right }}>{inr(inv.taxable)}</td>}
                {inv.hasGst && <td style={{ ...td, ...right }}>{inv.gstRate}%</td>}
                <td style={{ ...td, ...right }}>{inr(inv.total)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginLeft: 'auto', width: 'min(100%, 320px)', marginTop: 16, fontSize: 13 }}>
            {inv.hasGst ? (
              <>
                <Row label="Taxable value" value={inr(inv.taxable)} />
                {intra ? (
                  <>
                    <Row label={`CGST @ ${inv.gstRate / 2}%`} value={inr(inv.cgst)} />
                    <Row label={`SGST @ ${inv.gstRate / 2}%`} value={inr(inv.sgst)} />
                  </>
                ) : (
                  <Row label={`IGST @ ${inv.gstRate}%`} value={inr(inv.igst)} />
                )}
              </>
            ) : (
              <Row label="GST" value="Not applicable" />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4, borderTop: '2px solid #222', fontWeight: 700, fontSize: 16 }}>
              <span>Total paid</span><span>{inr(inv.total)}</span>
            </div>
          </div>

          <div style={{ marginTop: 18, fontSize: 13 }}><b>Amount in words:</b> {inv.totalInWords}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#166534' }}><b>Paid in full.</b> This invoice was issued after your payment was received.</div>

          {inv.seller.footer && <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #ddd', fontSize: 12, color: '#555', whiteSpace: 'pre-line' }}>{inv.seller.footer}</div>}
          <div style={{ marginTop: 18, fontSize: 11, color: '#888' }}>This is a computer-generated invoice and does not require a signature.</div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{label}</span><span>{value}</span></div>;
}
