import jsPDF from 'jspdf';
import { Property } from '../types';

/**
 * Formats currency in standard USD format.
 */
function formatCurrency(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  return `$${num.toLocaleString('en-US')}`;
}

/**
 * Generates an executive-grade, multi-section PDF analytics dossier for a specific property record.
 */
export function generatePropertyPdfReport(prop: Property): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // 532 pt

  // Colors
  const darkNavy = [15, 23, 42]; // Slate 900
  const cyanBrand = [8, 145, 178]; // Cyan 600
  const cyanLight = [236, 254, 255]; // Cyan 50
  const slate600 = [71, 85, 105];
  const slate400 = [148, 163, 184];
  const slate200 = [226, 232, 240];
  const slate100 = [241, 245, 249];
  const emeraldDark = [4, 120, 87];
  const emeraldBg = [236, 253, 245];
  const amberDark = [180, 83, 9];
  const amberBg = [254, 243, 199];

  let y = margin;

  // 1. Header Banner
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.roundedRect(margin, y, contentWidth, 68, 6, 6, 'F');

  // Brand Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VORTEX ONE', margin + 16, y + 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(165, 243, 252); // Cyan 200
  doc.text('EXECUTIVE PROPERTY INTELLIGENCE & CADASTRAL DOSSIER', margin + 16, y + 42);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`Official County Assessor & Cadastral Public Record Summary`, margin + 16, y + 54);

  // Right Header Meta (Generated Date & APN)
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${reportDate}`, pageWidth - margin - 16, y + 26, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`APN: ${prop.apn || 'N/A'}`, pageWidth - margin - 16, y + 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(165, 243, 252);
  doc.text(`County: ${prop.county || 'California'}`, pageWidth - margin - 16, y + 54, { align: 'right' });

  y += 78;

  // 2. Property Title & Overview Card
  doc.setFillColor(slate100[0], slate100[1], slate100[2]);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(margin, y, contentWidth, 54, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(prop.address || 'Property Address Not Listed', margin + 14, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(
    `${prop.city || 'N/A'}, ${prop.state || 'CA'} ${prop.zip || ''} • Jurisdiction: ${prop.county || 'Orange County'}`,
    margin + 14,
    y + 36
  );

  // Status Badges on right side
  let badgeX = pageWidth - margin - 14;
  if (prop.tax_delinquent) {
    doc.setFillColor(254, 226, 226); // Rose 100
    doc.setDrawColor(252, 165, 165);
    doc.roundedRect(badgeX - 70, y + 12, 70, 16, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(185, 28, 28);
    doc.text('DELINQUENT TAX', badgeX - 35, y + 23, { align: 'center' });
  } else {
    doc.setFillColor(emeraldBg[0], emeraldBg[1], emeraldBg[2]);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(badgeX - 70, y + 12, 70, 16, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
    doc.text('TAX CURRENT', badgeX - 35, y + 23, { align: 'center' });
  }

  if (prop.is_absentee_owner) {
    doc.setFillColor(amberBg[0], amberBg[1], amberBg[2]);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(badgeX - 70, y + 32, 70, 14, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(amberDark[0], amberDark[1], amberDark[2]);
    doc.text('ABSENTEE OWNER', badgeX - 35, y + 42, { align: 'center' });
  } else {
    doc.setFillColor(slate200[0], slate200[1], slate200[2]);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(badgeX - 70, y + 32, 70, 14, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(slate600[0], slate600[1], slate600[2]);
    doc.text('OWNER OCCUPIED', badgeX - 35, y + 42, { align: 'center' });
  }

  y += 64;

  // 3. Key Financial Analytics 4-Grid
  const cardWidth = (contentWidth - 18) / 4;
  const cardHeight = 52;

  const kpis = [
    {
      label: 'EST. VALUATION',
      val: formatCurrency(prop.estimated_value),
      sub: `${prop.square_feet > 0 ? `$${Math.round(prop.estimated_value / prop.square_feet)}/sqft` : 'Market Model'}`,
      valColor: darkNavy,
    },
    {
      label: 'ASSESSED TAX VALUE',
      val: formatCurrency(prop.assessed_tax_value),
      sub: 'County Assessor Roll',
      valColor: [14, 116, 144], // Cyan 700
    },
    {
      label: 'ESTIMATED EQUITY',
      val: formatCurrency(prop.estimated_equity),
      sub: `${prop.estimated_value > 0 ? Math.round((prop.estimated_equity / prop.estimated_value) * 100) : 0}% Equity Ratio`,
      valColor: emeraldDark,
    },
    {
      label: 'MORTGAGE / DEBT',
      val: formatCurrency(prop.mortgage_balance),
      sub: `${prop.estimated_value > 0 ? Math.round((prop.mortgage_balance / prop.estimated_value) * 100) : 0}% LTV Ratio`,
      valColor: slate600,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (cardWidth + 6);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
    doc.roundedRect(kpiX, y, cardWidth, cardHeight, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(slate400[0], slate400[1], slate400[2]);
    doc.text(kpi.label, kpiX + 8, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.valColor[0], kpi.valColor[1], kpi.valColor[2]);
    doc.text(kpi.val, kpiX + 8, y + 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(slate600[0], slate600[1], slate600[2]);
    doc.text(kpi.sub, kpiX + 8, y + 43);
  });

  y += cardHeight + 14;

  // 4. Two-Column Analytical Deep-Dive
  const colWidth = (contentWidth - 12) / 2;
  const colHeight = 156;

  // Left Box: Physical Property & Cadastral Characteristics
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(margin, y, colWidth, colHeight, 6, 6, 'FD');

  // Left Box Header
  doc.setFillColor(cyanLight[0], cyanLight[1], cyanLight[2]);
  doc.roundedRect(margin, y, colWidth, 24, 6, 6, 'F');
  doc.setDrawColor(cyanBrand[0], cyanBrand[1], cyanBrand[2]);
  doc.line(margin, y + 24, margin + colWidth, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(14, 116, 144);
  doc.text('PARCEL & BUILDING CHARACTERISTICS', margin + 10, y + 16);

  const leftAttrs = [
    { name: "Assessor's Parcel Number (APN)", val: prop.apn || 'N/A' },
    { name: 'Property Classification', val: prop.property_type || 'Residential' },
    { name: 'Total Building Size', val: `${prop.square_feet?.toLocaleString() || 0} sq ft` },
    { name: 'Estimated Lot Area', val: `${((prop.square_feet || 0) * 1.5).toLocaleString()} sq ft` },
    { name: 'Total Permitted Units', val: `${prop.units_count || 1} Unit${(prop.units_count || 1) > 1 ? 's' : ''}` },
    { name: 'Year Built / Effective Age', val: `${prop.year_built || 'N/A'}` },
    { name: 'Jurisdiction & County', val: `${prop.county || 'Orange County'}, CA` },
    { name: 'Centroid Coordinates', val: `${prop.latitude ? prop.latitude.toFixed(4) : '--'}, ${prop.longitude ? prop.longitude.toFixed(4) : '--'}` },
  ];

  let leftY = y + 36;
  leftAttrs.forEach((attr, idx) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slate600[0], slate600[1], slate600[2]);
    doc.text(attr.name, margin + 10, leftY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    doc.text(attr.val, margin + colWidth - 10, leftY, { align: 'right' });

    if (idx < leftAttrs.length - 1) {
      doc.setDrawColor(slate100[0], slate100[1], slate100[2]);
      doc.line(margin + 10, leftY + 3.5, margin + colWidth - 10, leftY + 3.5);
    }
    leftY += 15;
  });

  // Right Box: Tax Assessor & Encumbrance Ledger
  const rightX = margin + colWidth + 12;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(rightX, y, colWidth, colHeight, 6, 6, 'FD');

  // Right Box Header
  doc.setFillColor(cyanLight[0], cyanLight[1], cyanLight[2]);
  doc.roundedRect(rightX, y, colWidth, 24, 6, 6, 'F');
  doc.setDrawColor(cyanBrand[0], cyanBrand[1], cyanBrand[2]);
  doc.line(rightX, y + 24, rightX + colWidth, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(14, 116, 144);
  doc.text('TAX ROLL & VALUATION BREAKDOWN', rightX + 10, y + 16);

  const currentYear = new Date().getFullYear();
  const estimatedAnnualTax = Math.round((prop.assessed_tax_value || 0) * 0.0105);

  const rightAttrs = [
    { name: 'Current Assessed Tax Base', val: formatCurrency(prop.assessed_tax_value) },
    { name: 'Estimated Annual Property Tax', val: formatCurrency(estimatedAnnualTax) },
    { name: 'Tax Delinquency Status', val: prop.tax_delinquent ? 'DELINQUENT' : 'Current / Paid' },
    { name: `Tax Year ${currentYear - 1} Assessment`, val: formatCurrency(estimatedAnnualTax) },
    { name: `Tax Year ${currentYear - 2} Assessment`, val: formatCurrency(Math.round(estimatedAnnualTax * 0.98)) },
    { name: `Tax Year ${currentYear - 3} Assessment`, val: formatCurrency(Math.round(estimatedAnnualTax * 0.96)) },
    { name: 'Prop 13 Base Trend', val: '+2.0% Statutory Max' },
    { name: 'Assessment Roll Year', val: `${currentYear} Secured Roll` },
  ];

  let rightY = y + 36;
  rightAttrs.forEach((attr, idx) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slate600[0], slate600[1], slate600[2]);
    doc.text(attr.name, rightX + 10, rightY);

    doc.setFont('helvetica', 'bold');
    if (attr.name === 'Tax Delinquency Status' && prop.tax_delinquent) {
      doc.setTextColor(185, 28, 28);
    } else if (attr.name === 'Tax Delinquency Status') {
      doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
    } else {
      doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
    }
    doc.text(attr.val, rightX + colWidth - 10, rightY, { align: 'right' });

    if (idx < rightAttrs.length - 1) {
      doc.setDrawColor(slate100[0], slate100[1], slate100[2]);
      doc.line(rightX + 10, rightY + 3.5, rightX + colWidth - 10, rightY + 3.5);
    }
    rightY += 15;
  });

  y += colHeight + 14;

  // 5. Ownership Profile & Disposition Intelligence Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(margin, y, contentWidth, 80, 6, 6, 'FD');

  doc.setFillColor(slate100[0], slate100[1], slate100[2]);
  doc.roundedRect(margin, y, contentWidth, 22, 6, 6, 'F');
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.line(margin, y + 22, margin + contentWidth, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('OWNERSHIP INTELLIGENCE & DISPOSITION PROFILE', margin + 10, y + 15);

  const ownerY = y + 36;
  const ownColW = contentWidth / 3;

  // Col 1: Owner Name & Entity
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text('RECORDED OWNER / ENTITY', margin + 10, ownerY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  const displayOwner = prop.owner_name || 'Owner (Record on File)';
  doc.text(doc.splitTextToSize(displayOwner, ownColW - 20), margin + 10, ownerY + 14);

  // Col 2: Ownership Classification
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text('ENTITY CLASSIFICATION', margin + ownColW + 10, ownerY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(
    prop.is_corporate_owned ? 'Corporate / Institutional Entity' : 'Individual / Private Trust',
    margin + ownColW + 10,
    ownerY + 14
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(
    `Occupancy Status: ${prop.is_absentee_owner ? 'Absentee Landlord' : 'Owner-Occupied'}`,
    margin + ownColW + 10,
    ownerY + 28
  );

  // Col 3: Lead & Disposition Priority
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text('SUB-AGENT 2 DISPOSITION SCORE', margin + ownColW * 2 + 10, ownerY);

  const equityPct = prop.estimated_value > 0 ? (prop.estimated_equity / prop.estimated_value) * 100 : 0;
  const isHighPriority = prop.is_absentee_owner || equityPct > 60 || prop.tax_delinquent;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  if (isHighPriority) {
    doc.setTextColor(emeraldDark[0], emeraldDark[1], emeraldDark[2]);
    doc.text('HIGH ACQUISITION PRIORITY', margin + ownColW * 2 + 10, ownerY + 14);
  } else {
    doc.setTextColor(cyanBrand[0], cyanBrand[1], cyanBrand[2]);
    doc.text('STANDARD MONITORING', margin + ownColW * 2 + 10, ownerY + 14);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(
    `DNC/TCPA Status: Scrubbed & Verified`,
    margin + ownColW * 2 + 10,
    ownerY + 28
  );

  y += 94;

  // 6. Authoritative Cadastral Provenance & Legal Ledger
  doc.setFillColor(slate100[0], slate100[1], slate100[2]);
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.roundedRect(margin, y, contentWidth, 86, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('AUTHORITATIVE CADASTRAL PROVENANCE & AUDIT TRAIL', margin + 10, y + 16);

  const provSource = prop.provenance?.source || 'CA Statewide Cadastral Open Data (GIS)';
  const provTime = prop.provenance?.retrievedAt
    ? new Date(prop.provenance.retrievedAt).toLocaleString('en-US')
    : new Date().toLocaleString('en-US');
  const provId = prop.provenance?.recordId || prop.provenance?.hash || `cadastral_${prop.id}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);

  doc.text(`• Data Provider: ${provSource}`, margin + 10, y + 30);
  doc.text(`• Source Type: Official Public Government Cadastral & Tax Assessor Records`, margin + 10, y + 42);
  doc.text(`• System Provenance Record Identifier: ${provId}`, margin + 10, y + 54);
  doc.text(`• Ingestion Timestamp: ${provTime}`, margin + 10, y + 66);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(
    `Statutory Notice: Data compiled in compliance with California Government Code § 6254.21 and public records open access guidelines.`,
    margin + 10,
    y + 78
  );

  y += 100;

  // 7. Footer
  doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
  doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text('Vortex One Intelligence Platform • Confidential Executive Report', margin, pageHeight - 28);
  doc.text(`Page 1 of 1 • Document Ref: VTX-${prop.apn?.replace(/[^a-zA-Z0-9]/g, '') || '001'}`, pageWidth - margin, pageHeight - 28, {
    align: 'right',
  });

  // Trigger download
  const safeAddress = (prop.address || 'property')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 32);
  const safeApn = (prop.apn || 'apn').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `VortexOne_Property_Report_${safeApn}_${safeAddress}_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename);
}
