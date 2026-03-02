"use client";

import { useState, useCallback } from "react";
import { ControlList } from "@/components/controls/control-list";
import { ControlRunnerDialog } from "@/components/controls/control-runner-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Company {
  id: string;
  name: string;
}

interface ControlsPageClientProps {
  companies: Company[];
}

export function ControlsPageClient({ companies }: ControlsPageClientProps) {
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCompleted = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Kontroller</h1>
          <p className="text-sm text-muted-foreground">
            Kjør og se kontroller for kundefordringer og leverandørgjeld
          </p>
        </div>
        <ControlRunnerDialog companies={companies} onCompleted={handleCompleted} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle typer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            <SelectItem value="accounts_receivable">Kundefordringer</SelectItem>
            <SelectItem value="accounts_payable">Leverandørgjeld</SelectItem>
          </SelectContent>
        </Select>

        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Alle selskaper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle selskaper</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <ControlList
        key={refreshKey}
        companyFilter={companyFilter === "all" ? undefined : companyFilter || undefined}
        typeFilter={typeFilter === "all" ? undefined : typeFilter || undefined}
      />
    </div>
  );
}
