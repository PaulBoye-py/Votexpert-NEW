import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/atoms';
import { getPaymentHistory, PLANS, type PlanKey } from '@/api/services/payment.service';

export function PaymentHistory() {
  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payment-history'],
    queryFn: () => getPaymentHistory(),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !payments) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center text-sm text-destructive">
        Failed to load payment history. Please refresh the page.
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No payments yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase py-3 px-3">Date</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase py-3 px-3">Plan</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase py-3 px-3">Amount</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase py-3 px-3">Reference</th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase py-3 px-3">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const planName = PLANS[payment.plan as PlanKey]?.name || payment.plan;
            const date = new Date(payment.paid_at).toLocaleString('en-NG', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <tr key={payment.payment_id} className="border-b border-border hover:bg-muted/40 transition-colors">
                <td className="py-3 px-3">
                  <span className="text-sm text-foreground">{date}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-sm font-medium text-foreground">{planName}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-sm text-foreground">
                    ₦{payment.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-xs font-mono text-muted-foreground break-all">{payment.reference}</span>
                </td>
                <td className="py-3 px-3">
                  {payment.receipt_url ? (
                    <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" download>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
