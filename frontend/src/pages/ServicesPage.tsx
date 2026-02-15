import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createService, deleteService, fetchServices, updateService } from "../services/servicesApi";

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [netPrice, setNetPrice] = useState("0.00");
  const [vatRate, setVatRate] = useState("19");

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

  return (
    <section className="panel" data-testid="services-page">
      <header className="panel-header">
        <div>
          <h2>Dienstleistungen</h2>
          <p className="panel-subtitle">Service-Katalog mit Netto-/Bruttopreisen.</p>
        </div>
      </header>

      <article className="subpanel">
        <h3>Service anlegen</h3>
        <form className="inline-form" onSubmit={(event) => void onSubmit(event)}>
          <input className="input" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="input" placeholder="Netto" value={netPrice} onChange={(event) => setNetPrice(event.target.value)} required />
          <select className="input" value={vatRate} onChange={(event) => setVatRate(event.target.value)}>
            <option value="19">19%</option>
            <option value="7">7%</option>
            <option value="0">0%</option>
          </select>
          <button className="btn" type="submit" disabled={createMutation.isPending}>Anlegen</button>
        </form>
      </article>

      <article className="subpanel">
        <h3>Services</h3>
        <div className="table-wrap">
          <table className="products-table mobile-cards-table" data-testid="services-table">
            <thead>
              <tr>
                <th>Nr</th>
                <th>Name</th>
                <th>Netto</th>
                <th>Brutto</th>
                <th>Status</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {(servicesQuery.data?.items ?? []).map((service) => (
                <tr key={service.id}>
                  <td data-label="Nr">{service.service_number}</td>
                  <td data-label="Name">{service.name}</td>
                  <td data-label="Netto">{service.net_price}</td>
                  <td data-label="Brutto">{service.gross_price}</td>
                  <td data-label="Status">{service.status}</td>
                  <td data-label="Aktion" className="actions-cell">
                    <button className="btn" type="button" onClick={() => void updateMutation.mutateAsync({ serviceId: service.id, status: "blocked" })}>Sperren</button>
                    <button className="btn" type="button" onClick={() => void updateMutation.mutateAsync({ serviceId: service.id, status: "active" })}>Aktiv</button>
                    <button className="btn" type="button" onClick={() => void deleteMutation.mutateAsync(service.id)}>Löschen</button>
                  </td>
                </tr>
              ))}
              {!servicesQuery.isLoading && (servicesQuery.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6}>Keine Services vorhanden.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
