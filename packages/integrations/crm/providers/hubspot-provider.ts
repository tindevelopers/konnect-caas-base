import { CrmProvider } from "../crm-interface";
import {
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmProviderCapabilities,
  CrmProviderConfig,
} from "../crm-types";

interface HubSpotCredentials {
  apiKey: string;
}

type HubSpotRecord = Record<string, unknown>;

export class HubSpotProvider implements CrmProvider {
  readonly name = "HubSpot";
  readonly type = "hubspot";
  readonly capabilities: CrmProviderCapabilities = {
    readContacts: true,
    writeContacts: true,
    readCompanies: true,
    writeCompanies: true,
    readDeals: true,
    writeDeals: true,
    readNotes: false,
    writeNotes: false,
    readTasks: false,
    writeTasks: false,
  };

  private credentials?: HubSpotCredentials;
  private readonly baseUrl = "https://api.hubapi.com";

  async initialize(config: CrmProviderConfig): Promise<void> {
    this.credentials = this.parseCredentials(config.credentials);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.credentials) return false;
    const response = (await this.request("/crm/v3/objects/contacts", {
      limit: "1",
    })) as HubSpotRecord;
    return Array.isArray(response.results);
  }

  async listContacts(): Promise<CrmContact[]> {
    const response = (await this.request("/crm/v3/objects/contacts", {
      limit: "100",
      properties: "firstname,lastname,email,phone,company",
    })) as HubSpotRecord;

    const rows = (response?.results as HubSpotRecord[]) ?? [];
    return rows.map((item) => this.mapContact(item));
  }

  async upsertContact(contact: CrmContact): Promise<CrmContact> {
    const properties = {
      firstname: contact.firstName,
      lastname: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      company: contact.companyId,
    };

    if (contact.id) {
      const response = await this.request(
        `/crm/v3/objects/contacts/${contact.id}`,
        undefined,
        "PATCH",
        { properties }
      );
      return this.mapContact(response as HubSpotRecord);
    }

    const response = await this.request(
      "/crm/v3/objects/contacts",
      undefined,
      "POST",
      { properties }
    );
    return this.mapContact(response as HubSpotRecord);
  }

  async deleteContact(id: string): Promise<boolean> {
    await this.request(`/crm/v3/objects/contacts/${id}`, undefined, "DELETE");
    return true;
  }

  async listCompanies(): Promise<CrmCompany[]> {
    const response = (await this.request("/crm/v3/objects/companies", {
      limit: "100",
      properties: "name,domain,phone,industry",
    })) as HubSpotRecord;

    const rows = (response?.results as HubSpotRecord[]) ?? [];
    return rows.map((item) => this.mapCompany(item));
  }

  async listDeals(): Promise<CrmDeal[]> {
    const response = (await this.request("/crm/v3/objects/deals", {
      limit: "100",
      properties: "dealname,dealstage,amount,closedate,hubspot_owner_id",
    })) as HubSpotRecord;

    const rows = (response?.results as HubSpotRecord[]) ?? [];
    return rows.map((item) => this.mapDeal(item));
  }

  async upsertDeal(deal: CrmDeal): Promise<CrmDeal> {
    const properties = {
      dealname: deal.title,
      dealstage: deal.stage,
      amount: deal.value,
      hubspot_owner_id: deal.ownerId,
    };

    if (deal.id) {
      const response = await this.request(
        `/crm/v3/objects/deals/${deal.id}`,
        undefined,
        "PATCH",
        { properties }
      );
      return this.mapDeal(response as HubSpotRecord);
    }

    const response = await this.request(
      "/crm/v3/objects/deals",
      undefined,
      "POST",
      { properties }
    );
    return this.mapDeal(response as HubSpotRecord);
  }

  private parseCredentials(credentials: Record<string, unknown>): HubSpotCredentials {
    const apiKey =
      typeof credentials.apiKey === "string"
        ? credentials.apiKey
        : typeof credentials.privateAppToken === "string"
          ? credentials.privateAppToken
          : "";

    if (!apiKey.trim()) {
      throw new Error("HubSpot credentials require apiKey (private app token).");
    }

    return { apiKey: apiKey.trim() };
  }

  private async request(
    path: string,
    query?: Record<string, string>,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ): Promise<unknown> {
    if (!this.credentials) {
      throw new Error("HubSpot provider is not initialized.");
    }

    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`HubSpot request failed (${response.status}): ${responseText}`);
    }

    if (method === "DELETE") {
      return {};
    }
    return response.json();
  }

  private mapContact(item: HubSpotRecord): CrmContact {
    const properties = (item.properties as HubSpotRecord) ?? {};
    return {
      id: String(item.id ?? ""),
      firstName: String(properties.firstname ?? ""),
      lastName: this.optionalString(properties.lastname),
      email: this.optionalString(properties.email),
      phone: this.optionalString(properties.phone),
      companyId: this.optionalString(properties.company),
      metadata: {
        raw: item,
      },
    };
  }

  private mapCompany(item: HubSpotRecord): CrmCompany {
    const properties = (item.properties as HubSpotRecord) ?? {};
    return {
      id: String(item.id ?? ""),
      name: String(properties.name ?? ""),
      website: this.optionalString(properties.domain),
      phone: this.optionalString(properties.phone),
      industry: this.optionalString(properties.industry),
      metadata: {
        raw: item,
      },
    };
  }

  private mapDeal(item: HubSpotRecord): CrmDeal {
    const properties = (item.properties as HubSpotRecord) ?? {};
    const parsedValue = Number(properties.amount);
    return {
      id: String(item.id ?? ""),
      title: String(properties.dealname ?? ""),
      stage: this.optionalString(properties.dealstage),
      value: Number.isFinite(parsedValue) ? parsedValue : undefined,
      ownerId: this.optionalString(properties.hubspot_owner_id),
      metadata: {
        raw: item,
      },
    };
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
      ? value
      : undefined;
  }
}
