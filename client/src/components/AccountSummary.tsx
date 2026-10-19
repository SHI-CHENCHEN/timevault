import { formatMinutes, type TimeAccount } from "@timevault/shared";

export function AccountSummary({ account }: { account: TimeAccount }) {
  return (
    <div className="account-summary" aria-label="Personal time account summary">
      <div><span>ACCUMULATED</span><strong>{formatMinutes(account.totalSold)}</strong></div>
      <div><span>RECOVERED</span><strong>{formatMinutes(account.totalRecovered)}</strong></div>
      <div><span>ACTIVE FRAGMENTS</span><strong>{String(account.fragmentCount).padStart(2, "0")}</strong></div>
      <div><span>LARGEST FORM</span><strong>{formatMinutes(account.largestAccumulatedBlock)}</strong></div>
    </div>
  );
}
