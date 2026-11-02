import { renderBadgeHtml, type BadgePerson } from "@/lib/employee-badge";

export function EmployeeIdCard({ person }: { person: BadgePerson }) {
  return <div dangerouslySetInnerHTML={{ __html: renderBadgeHtml(person) }} />;
}
