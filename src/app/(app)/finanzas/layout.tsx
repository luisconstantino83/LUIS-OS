import { PageHeader } from "@/components/ui";
import { FinanceNav } from "./finance-nav";

export default function FinanceLayout({ children }: LayoutProps<"/finanzas">) {
  return (
    <>
      <PageHeader title="Libertad financiera" subtitle="Cada peso con una función. Los números informan; tú decides." />
      <FinanceNav />
      {children}
    </>
  );
}
