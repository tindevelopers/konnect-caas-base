import { CrmProvider } from '../crm-interface';
import {
  CrmContact,
  CrmCompany,
  CrmDeal,
  CrmNote,
  CrmProviderConfig,
  CrmProviderCapabilities,
  CrmTask,
} from '../crm-types';

interface GoHighLevelCredentials {
  apiKey: string;
  locationId: string;
}

interface GoHighLevelRecord {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  value?: number;
  stage?: string;
  status?: string;
  externalId?: string;
  text?: string;
  dueDate?: string;
  owner?: string;
  entityId?: string;
}

export class GoHighLevelProvider implements CrmProvider {
  readonly name = 'GoHighLevel';
  readonly type = 'gohighlevel';
  readonly capabilities: CrmProviderCapabilities = {
    readContacts: true,
    writeContacts: true,
    readCompanies: true,
    writeCompanies: false, // GHL limits company editing via API
    readDeals: true,
    writeDeals: true,
    readNotes: true,
    writeNotes: true,
    readTasks: true,
    writeTasks: true,
  };

  private config?: CrmProviderConfig;
  private credentials?: GoHighLevelCredentials;
  private baseUrl = 'https://rest.gohighlevel.com/v1';

  async initialize(config: CrmProviderConfig): Promise<void> {
    this.config = config;
    this.credentials = this.parseCredentials(config.credentials);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.credentials) {
      return false;
    }

    const response = await this.request('/accounts/me');
    return response.status === 'success';
  }

  async listContacts(): Promise<CrmContact[]> {
    const data = await this.request('/contacts', { locationId: this.credentials?.locationId });
    return (data.contacts ?? []).map(this.mapContact);
  }

  async upsertContact(contact: CrmContact): Promise<CrmContact> {
    const payload = {
      ...contact,
      locationId: this.credentials?.locationId,
    };

    const result = await this.request('/contacts', payload, 'POST');
    return this.mapContact(result.contact ?? {});
  }

  async deleteContact(id: string): Promise<boolean> {
    await this.request(`/contacts/${id}`, undefined, 'DELETE');
    return true;
  }

  async listCompanies(): Promise<CrmCompany[]> {
    const data = await this.request('/companies', { locationId: this.credentials?.locationId });
    return (data.companies ?? []).map(this.mapCompany);
  }

  async listDeals(): Promise<CrmDeal[]> {
    const data = await this.request('/opportunities', { locationId: this.credentials?.locationId });
    return (data.opportunities ?? []).map(this.mapDeal);
  }

  async upsertDeal(deal: CrmDeal): Promise<CrmDeal> {
    const result = await this.request('/opportunities', {
      ...deal,
      locationId: this.credentials?.locationId,
    }, 'POST');
    return this.mapDeal(result.opportunity ?? {});
  }

  async listNotes(): Promise<CrmNote[]> {
    const data = await this.request('/notes', { locationId: this.credentials?.locationId });
    return (data.notes ?? []).map(this.mapNote);
  }

  async createNote(note: CrmNote): Promise<CrmNote> {
    const payload = {
      ...note,
      locationId: this.credentials?.locationId,
    };
    const result = await this.request('/notes', payload, 'POST');
    return this.mapNote(result.note ?? {});
  }

  async listTasks(): Promise<CrmTask[]> {
    const data = await this.request('/tasks', { locationId: this.credentials?.locationId });
    return (data.tasks ?? []).map(this.mapTask);
  }

  async upsertTask(task: CrmTask): Promise<CrmTask> {
    const result = await this.request('/tasks', {
      ...task,
      locationId: this.credentials?.locationId,
    }, 'POST');
    return this.mapTask(result.task ?? {});
  }

  async completeTask(id: string): Promise<boolean> {
    await this.request(`/tasks/${id}/complete`, undefined, 'POST');
    return true;
  }

  private parseCredentials(credentials: Record<string, any>): GoHighLevelCredentials {
    if (!credentials.apiKey || !credentials.locationId) {
      throw new Error('GoHighLevel credentials require apiKey and locationId');
    }

    return {
      apiKey: credentials.apiKey,
      locationId: credentials.locationId,
    };
  }

  private async request(
    path: string,
    payload?: Record<string, any>,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
  ): Promise<any> {
    if (!this.credentials) {
      throw new Error('Provider not initialized');
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.credentials.apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GHL request failed: ${response.status} ${body}`);
    }

    return response.json();
  }

  private mapContact = (item: GoHighLevelRecord): CrmContact => ({
    id: item.id,
    firstName: item.firstName ?? '',
    lastName: item.lastName,
    email: item.email,
    phone: item.phone,
    metadata: {
      externalId: item.externalId,
    },
  });

  private mapCompany = (item: GoHighLevelRecord): CrmCompany => ({
    id: item.id,
    name: item.name ?? '',
    phone: item.phone,
    metadata: {
      externalId: item.externalId,
    },
  });

  private mapDeal = (item: GoHighLevelRecord): CrmDeal => ({
    id: item.id,
    title: item.name ?? '',
    stage: item.stage,
    value: item.value,
    currency: item.currency,
    metadata: {
      externalId: item.externalId,
    },
  });

  private mapNote = (item: GoHighLevelRecord): CrmNote => ({
    id: item.id,
    text: item.text ?? '',
    entityId: item.entityId ?? '',
    entityType: 'contacts',
    createdAt: new Date().toISOString(),
    metadata: {
      authorId: item.owner,
    },
  });

  private mapTask = (item: GoHighLevelRecord): CrmTask => ({
    id: item.id,
    title: item.name ?? '',
    dueDate: item.dueDate,
    status: item.status as CrmTask['status'],
    assigneeId: item.owner,
    entityId: item.entityId,
    entityType: 'contacts',
    metadata: {
      externalId: item.externalId,
    },
  });
}
