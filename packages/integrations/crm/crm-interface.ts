import {
  CrmContact,
  CrmCompany,
  CrmDeal,
  CrmNote,
  CrmProviderCapabilities,
  CrmProviderConfig,
  CrmTask,
} from './crm-types';

export interface CrmProvider {
  readonly name: string;
  readonly type: string;
  readonly capabilities: CrmProviderCapabilities;

  initialize(config: CrmProviderConfig): Promise<void>;

  healthCheck(): Promise<boolean>;

  listContacts?(query?: Record<string, any>): Promise<CrmContact[]>;
  upsertContact?(contact: CrmContact): Promise<CrmContact>;
  deleteContact?(id: string): Promise<boolean>;

  listCompanies?(query?: Record<string, any>): Promise<CrmCompany[]>;
  upsertCompany?(company: CrmCompany): Promise<CrmCompany>;
  deleteCompany?(id: string): Promise<boolean>;

  listDeals?(query?: Record<string, any>): Promise<CrmDeal[]>;
  upsertDeal?(deal: CrmDeal): Promise<CrmDeal>;
  deleteDeal?(id: string): Promise<boolean>;

  listNotes?(query?: Record<string, any>): Promise<CrmNote[]>;
  createNote?(note: CrmNote): Promise<CrmNote>;

  listTasks?(query?: Record<string, any>): Promise<CrmTask[]>;
  upsertTask?(task: CrmTask): Promise<CrmTask>;
  completeTask?(id: string): Promise<boolean>;

  handleWebhook?(payload: any): Promise<void>;
}
