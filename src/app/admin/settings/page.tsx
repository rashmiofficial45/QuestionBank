import { getTaxonomy, getTestDefaults } from "@/modules/editorial-settings";
import { TaxonomyForm, TaxonomyRow, TestDefaultsForm } from "@/components/editorial-settings-forms";

export default async function SettingsPage() {
  const [settings, entries] = await Promise.all([getTestDefaults(), getTaxonomy()]);
  return <>
    <div className="page-heading"><h1>Editorial settings</h1></div>
    <section className="panel bank-panel"><h2>Practice test defaults</h2><TestDefaultsForm settings={settings} /></section>
    <section className="panel bank-panel admin-section">
      <h2>Subjects, topics, subtopics, and tags</h2>
      <p className="text-sm text-muted-foreground">Manage the suggestions offered when editing a draft. Existing question labels are preserved.</p>
      <TaxonomyForm entries={entries} />
      <div className="mt-5">{entries.map((entry) => <TaxonomyRow entry={entry} parent={entries.find((item) => item.id === entry.parent)?.name} key={entry.id} />)}</div>
    </section>
  </>;
}
