import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, MoreVertical, Trash2, CheckCircle, Ban, ArrowUpRight } from "lucide-react";

import { createService, deleteService, fetchServices, updateService } from "../services/servicesApi";

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [netPrice, setNetPrice] = useState("0.00");
  const [vatRate, setVatRate] = useState("19");

  // Mobile search state
  const [searchTerm, setSearchTerm] = useState("");

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => fetchServices({ page: 1, pageSize: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: async () => {
      setName("");
      setNetPrice("0.00");
      setVatRate("19");
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ serviceId, status }: { serviceId: number; status: "active" | "blocked" | "archived" }) =>
      updateService(serviceId, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      name: name.trim(),
      net_price: netPrice,
      vat_rate: vatRate,
      currency: "EUR",
      status: "active",
    });
  };

  const filteredServices = (servicesQuery.data?.items ?? []).filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.service_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Aktiv</span>;
      case "blocked":
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Gesperrt</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="page" data-testid="services-page">
      <div className="w-full h-full flex flex-col gap-6 max-w-[1920px] mx-auto">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">Dienstleistungen</h1>
        <p className="section-subtitle max-w-2xl break-words">
          Verwaltung des Service-Katalogs mit Preisen und Steuer-Einstellungen.
        </p>
      </header>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column: Create Form */}
        <div className="xl:col-span-1">
          <div className="rounded-xl border border-border bg-card shadow-sm p-4 md:p-6 flex flex-col gap-6 sticky top-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <h2 className="section-title tracking-tight text-card-foreground">Neuen Service anlegen</h2>
            </div>

            <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
              <div className="space-y-1.5">
                <label className="form-label-standard leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Bezeichnung
                </label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
                  placeholder="z.B. Wartung Standard"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="form-label-standard leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Netto Preis (€)
                  </label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
                    placeholder="0.00"
                    value={netPrice}
                    onChange={(event) => setNetPrice(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="form-label-standard leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    MwSt. Satz
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
                    value={vatRate}
                    onChange={(event) => setVatRate(event.target.value)}
                  >
                    <option value="19">19%</option>
                    <option value="7">7%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
              </div>

              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full mt-2"
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Wird angelegt..." : "Service erstellen"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List */}
        <div className="xl:col-span-2 flex flex-col gap-6">

          {/* Mobile Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Suchen..."
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {/* Future filters could go here */}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border bg-muted/5 flex justify-between items-center">
              <h3 className="section-title text-card-foreground">Aktive Services</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {filteredServices.length} Einträge
              </span>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full caption-bottom text-sm" data-testid="services-table">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="table-head-standard h-12 px-4 text-left align-middle w-[100px]">Nr.</th>
                    <th className="table-head-standard h-12 px-4 text-left align-middle">Bezeichnung</th>
                    <th className="table-head-standard h-12 px-4 text-right align-middle w-[120px]">Netto</th>
                    <th className="table-head-standard h-12 px-4 text-right align-middle w-[120px]">Brutto</th>
                    <th className="table-head-standard h-12 px-4 text-center align-middle w-[100px]">Status</th>
                    <th className="table-head-standard h-12 px-4 text-right align-middle w-[140px]">Aktion</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 align-middle font-medium">{service.service_number}</td>
                      <td className="p-4 align-middle">
                        <span className="font-medium truncate block max-w-[250px] lg:max-w-[400px]" title={service.name}>
                          {service.name}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-right font-mono">{service.net_price} €</td>
                      <td className="p-4 align-middle text-right font-mono text-muted-foreground">{service.gross_price} €</td>
                      <td className="p-4 align-middle text-center">{getStatusBadge(service.status)}</td>
                      <td className="p-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          {service.status === 'active' ? (
                            <button
                              onClick={() => void updateMutation.mutateAsync({ serviceId: service.id, status: "blocked" })}
                              className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-orange-600 transition-colors"
                              title="Sperren"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => void updateMutation.mutateAsync({ serviceId: service.id, status: "active" })}
                              className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-green-600 transition-colors"
                              title="Aktivieren"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => void deleteMutation.mutateAsync(service.id)}
                            className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-destructive transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredServices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="h-24 text-center text-muted-foreground">
                        Keine Services gefunden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {filteredServices.map((service) => (
                <div key={service.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {service.service_number}
                        </span>
                        {getStatusBadge(service.status)}
                      </div>
                      <h4 className="font-medium text-base break-words leading-snug">{service.name}</h4>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-lg">{service.net_price} €</div>
                      <div className="text-xs text-muted-foreground">Netto</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">Brutto: {service.gross_price} €</span>
                    <div className="flex gap-1">
                      {service.status === 'active' ? (
                        <button
                          onClick={() => void updateMutation.mutateAsync({ serviceId: service.id, status: "blocked" })}
                          className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-orange-600"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => void updateMutation.mutateAsync({ serviceId: service.id, status: "active" })}
                          className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-green-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => void deleteMutation.mutateAsync(service.id)}
                        className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Keine Services gefunden.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
