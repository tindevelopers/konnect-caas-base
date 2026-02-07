import { redirect } from 'next/navigation';

/**
 * Redirect from old /templates/saas route to new /saas route
 * This handles legacy URLs after the template structure refactoring
 */
export default function TemplatesSaaSRedirect() {
  redirect('/saas');
}




