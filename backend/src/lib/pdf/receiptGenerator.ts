import PDFDocument from 'pdfkit';
import type { Payment } from '../../types';

interface ReceiptOrg {
  org_id: string;
  org_name: string;
  email?: string;
}

const COLORS = {
  primary: '#2563eb',
  text: '#1f2937',
  lightText: '#6b7280',
  border: '#e5e7eb',
  success: '#16a34a',
};

export async function generateReceiptPDF(
  payment: Payment,
  org: ReceiptOrg
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const buffers: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fillColor(COLORS.primary).fontSize(24).font('Helvetica-Bold').text('VoteXpert', { align: 'left' });
    doc.moveDown(0.3);
    doc.fillColor(COLORS.text).fontSize(11).font('Helvetica').text('Payment Receipt', { align: 'left' });

    // Horizontal line
    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke(COLORS.border);
    doc.moveDown(0.8);

    // Receipt number and date
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica-Bold');
    doc.text('Receipt Details', { underline: true });
    doc.moveDown(0.4);

    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text);
    doc.text(`Receipt Date: ${new Date(payment.paid_at).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`, { align: 'left' });

    doc.text(`Reference: ${payment.reference}`, { align: 'left' });
    doc.text(`Source: ${payment.source === 'webhook' ? 'Paystack Webhook' : 'Payment Verification'}`, {
      align: 'left',
    });

    doc.moveDown(0.6);

    // Organization information
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text);
    doc.text('Bill To:', { underline: true });
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(`Organization: ${org.org_name}`, { align: 'left' });
    doc.text(`Email: ${payment.email || org.email || 'N/A'}`, { align: 'left' });
    doc.text(`Organization ID: ${org.org_id}`, { align: 'left' });

    doc.moveDown(0.8);

    // Payment details table
    const tableTop = doc.y;
    const col1X = 40;
    const col2X = 300;
    const col3X = 450;

    // Table header
    doc.rect(col1X, tableTop, 510, 25).fillAndStroke(COLORS.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Description', col1X + 10, tableTop + 7);
    doc.text('Amount', col2X + 10, tableTop + 7);
    doc.text('Plan', col3X + 10, tableTop + 7);

    // Table body
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);
    let currentY = tableTop + 30;

    doc.text('Monthly Election Plan', col1X + 10, currentY);
    doc.text(`₦${payment.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, col2X + 10, currentY);
    doc.text(capitalizeFirst(payment.plan), col3X + 10, currentY);

    currentY += 25;

    // Subtotal and total
    currentY += 15;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Total Amount:', col1X + 10, currentY);
    doc.fillColor(COLORS.success).text(
      `₦${payment.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      col3X + 10,
      currentY,
      { align: 'left' }
    );

    currentY += 30;

    // Divider
    doc.moveTo(40, currentY).lineTo(550, currentY).stroke(COLORS.border);
    doc.moveDown(0.6);

    // Plan details
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10);
    doc.text('Plan Activated', { underline: true });
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.lightText);
    const planDetails = getPlanDetails(payment.plan);
    doc.text(`Plan: ${capitalizeFirst(payment.plan)} - ${planDetails.description}`, { align: 'left' });
    doc.text(`Elections per month: ${planDetails.electionsPerMonth}`, { align: 'left' });
    doc.text(`Max positions: ${planDetails.maxPositions === Infinity ? 'Unlimited' : planDetails.maxPositions}`, {
      align: 'left',
    });
    doc.text(`Payment method: Paystack`, { align: 'left' });

    doc.moveDown(1);

    // Footer
    doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke(COLORS.border);
    doc.moveDown(0.6);

    doc.fontSize(8).fillColor(COLORS.lightText).text(
      'Thank you for your payment! Your plan is now active and ready to use.',
      { align: 'center' }
    );

    doc.text('For support, contact: support@votexpert.com', { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-NG')}`, { align: 'center' });

    doc.end();
  });
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
}

interface PlanDetail {
  description: string;
  electionsPerMonth: number;
  maxPositions: number | Infinity;
}

function getPlanDetails(plan: string): PlanDetail {
  const plans: Record<string, PlanDetail> = {
    free: {
      description: 'Free Plan',
      electionsPerMonth: 1,
      maxPositions: 2,
    },
    standard: {
      description: 'Standard Plan',
      electionsPerMonth: 2,
      maxPositions: 5,
    },
    pro: {
      description: 'Pro Plan',
      electionsPerMonth: 2,
      maxPositions: 10,
    },
    standard_pro: {
      description: 'Standard Pro Plan',
      electionsPerMonth: 2,
      maxPositions: Infinity,
    },
  };

  return plans[plan] || plans.free;
}
