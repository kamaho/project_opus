"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AldersFilter = "alle" | "gjeldende" | "1-30" | "31-50" | "51-90" | "over90";
export type OppfolgingFilter = "alle" | "uten" | "pagar" | "fullfort";
export type SortField = "saldo" | "risiko" | "alder";

interface ReportFilterBarProps {
  search: string;
  onSearch: (v: string) => void;
  aldersFilter: AldersFilter;
  onAldersFilter: (v: AldersFilter) => void;
  oppfolgingFilter: OppfolgingFilter;
  onOppfolgingFilter: (v: OppfolgingFilter) => void;
  sortField: SortField;
  onSortField: (v: SortField) => void;
  totalAntall: number;
  filtrertAntall: number;
}

export function ReportFilterBar({
  search,
  onSearch,
  aldersFilter,
  onAldersFilter,
  oppfolgingFilter,
  onOppfolgingFilter,
  sortField,
  onSortField,
  totalAntall,
  filtrertAntall,
}: ReportFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søk kunde..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-8 w-[200px] pl-8 text-xs"
          />
        </div>

        <Select value={aldersFilter} onValueChange={(v) => onAldersFilter(v as AldersFilter)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Alle aldersgrupper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle aldersgrupper</SelectItem>
            <SelectItem value="gjeldende">Gjeldende (ikke forfalt)</SelectItem>
            <SelectItem value="1-30">Forfalt 1–30 dager</SelectItem>
            <SelectItem value="31-50">Forfalt 31–50 dager</SelectItem>
            <SelectItem value="51-90">Forfalt 51–90 dager</SelectItem>
            <SelectItem value="over90">Forfalt mer enn 90 dager</SelectItem>
          </SelectContent>
        </Select>

        <Select value={oppfolgingFilter} onValueChange={(v) => onOppfolgingFilter(v as OppfolgingFilter)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Oppfølging" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statuser</SelectItem>
            <SelectItem value="uten">Uten oppfølging</SelectItem>
            <SelectItem value="pagar">Oppfølging pågår</SelectItem>
            <SelectItem value="fullfort">Fullført</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => onSortField(v as SortField)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Sorter etter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="saldo">Beløp (høyest)</SelectItem>
            <SelectItem value="risiko">Risiko (høyest)</SelectItem>
            <SelectItem value="alder">Alder (eldst)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground shrink-0">
        Viser {filtrertAntall} av {totalAntall} kunder
      </p>
    </div>
  );
}
