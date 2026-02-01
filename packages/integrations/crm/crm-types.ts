export type CrmEntityType = 'contacts' | 'companies' | 'deals' | 'notes' | 'tasks';

export interface CrmEntityRef {
  id: string;
  externalId?: string;
  type: CrmEntityType;
}

export interface CrmContact {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyId?: string;
  metadata?: Record<string, any>;
}

export interface CrmCompany {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface CrmDeal {
  id: string;
  title: string;
  stage?: string;
  value?: number;
  currency?: string;
  ownerId?: string;
  metadata?: Record<string, any>;
}

export interface CrmNote {
  id: string;
  text: string;
  authorId?: string;
  entityId: string;
  entityType: CrmEntityType;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface CrmTask {
  id: string;
  title: string;
  dueDate?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  assigneeId?: string;
  entityId?: string;
  entityType?: CrmEntityType;
  metadata?: Record<string, any>;
}

export interface CrmProviderConfig {
  provider: string;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
}

export interface CrmProviderCapabilities {
  readContacts: boolean;
  writeContacts: boolean;
  readCompanies: boolean;
  writeCompanies: boolean;
  readDeals: boolean;
  writeDeals: boolean;
  readNotes: boolean;
  writeNotes: boolean;
  readTasks: boolean;
  writeTasks: boolean;
}
