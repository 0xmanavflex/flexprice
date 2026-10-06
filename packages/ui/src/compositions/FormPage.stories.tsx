import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Badge } from '@ui/components/reui/badge'
import { Input } from '@ui/components/primitives/input'
import { FormCard, FormRow } from './FormCard'
import { FormPage, type FormPageProps } from './FormPage'
import { FormPreview, PreviewAmount, PreviewRow, PreviewRows, PreviewSection } from './FormPreview'
import { useFormSteps } from './useFormSteps'

/**
 * One form shell, two optional parts. A simple form passes neither and is a
 * centred set of fields under the pinned toolbar. A staged form passes
 * `stepper` (drawn in the header) and a long one adds `preview` (the live
 * rail). The caller still owns the `<form>`, its schema and its submit handler.
 */
const meta = {
  title: 'Foundation/Compositions/Form page',
  component: FormPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FormPage>

export default meta
type Story = StoryObj<typeof meta>

const trail = [{ label: 'Groups' }, { label: 'New group' }]

const toolbar = {
  mode: 'create',
  noun: 'group',
  formId: 'demo-form',
  onCancel: fn(),
} satisfies NonNullable<Extract<FormPageProps, { toolbar: unknown }>['toolbar']>

function Fields() {
  return (
    <FormCard>
      <FormRow label="Name" required>
        {({ id, ...field }) => <Input id={id} {...field} />}
      </FormRow>
    </FormCard>
  )
}

function Preview({ name }: { name: string }) {
  return (
    <FormPreview
      title="Summary"
      description="Updates as you fill in each step."
      badge={<Badge>Draft</Badge>}
    >
      <PreviewAmount label="Per month" value="$29.00" hint="Billed in advance" />
      <PreviewSection title="Plan">
        <PreviewRows>
          <PreviewRow label="Name" value={name} />
          <PreviewRow label="Seats" value="5" />
        </PreviewRows>
      </PreviewSection>
    </FormPreview>
  )
}

export const SimpleFields: Story = {
  args: { title: 'Create group', trail, toolbar, children: <Fields /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Create group' })).toBeVisible()
    await expect(canvas.queryByRole('complementary')).toBeNull()
    await expect(canvas.queryByRole('group', { name: 'Steps' })).toBeNull()
  },
}

function Staged({ withPreview }: { withPreview: boolean }) {
  const flow = useFormSteps({
    steps: [
      { id: 'basics', title: 'Basic info', description: 'Name it' },
      { id: 'charges', title: 'Charges', description: 'What it bills' },
      { id: 'review', title: 'Review', description: 'Check and create' },
    ],
  })
  return (
    <FormPage
      title="Create plan"
      trail={trail}
      width="wide"
      toolbar={{ ...toolbar, noun: 'plan' }}
      stepper={{ flow, label: 'Plan steps' }}
      {...(withPreview ? { preview: <Preview name="Growth" /> } : {})}
    >
      <FormCard title={flow.steps.find((s) => s.id === flow.step)?.title ?? ''}>
        <p className="text-muted-foreground px-6 py-4 text-sm">Fields for the {flow.step} step.</p>
      </FormCard>
    </FormPage>
  )
}

export const WithStepper: Story = {
  args: { title: 'Create plan', trail, toolbar, children: null },
  render: () => <Staged withPreview={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Create plan' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /Next/ }))
    await userEvent.click(canvas.getByRole('button', { name: /Next/ }))
    await expect(canvas.getByRole('button', { name: 'Create plan' })).toBeVisible()
  },
}

export const WithStepperAndPreview: Story = {
  args: { title: 'Create plan', trail, toolbar, children: null },
  render: () => <Staged withPreview />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('complementary', { name: 'Summary' }),
    ).toBeVisible()
  },
}
