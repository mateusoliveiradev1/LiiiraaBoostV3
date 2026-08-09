import type { ReactNode, Ref } from 'react';
import {
  Button,
  ComboBox,
  Dialog,
  DialogTrigger,
  FieldError,
  Heading,
  Input,
  Label,
  Link,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  ProgressBar,
  RadioButton,
  RadioField,
  RadioGroup,
  SearchField,
  Select,
  SelectValue,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  SwitchButton,
  SwitchField,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  TextArea,
  TextField,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import type { Key } from 'react-aria-components';

export type LbButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

export const LB_INTERACTION_STATES = Object.freeze([
  'default',
  'hover',
  'focus-visible',
  'pressed',
  'disabled',
  'loading',
] as const);

export const LB_MOTION_ROLES = Object.freeze({
  panel: '200ms',
  route: '220ms',
  selection: '160ms',
  tone: '100ms',
} as const);

export interface LbButtonProps {
  readonly ariaLabel?: string;
  readonly buttonRef?: Ref<HTMLButtonElement>;
  readonly children: ReactNode;
  readonly className?: string;
  readonly isDisabled?: boolean;
  readonly isLoading?: boolean;
  readonly loadingLabel?: string;
  readonly onPress?: () => void;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly variant?: LbButtonVariant;
}

export const LbButton = ({
  ariaLabel,
  buttonRef,
  children,
  className,
  isDisabled = false,
  isLoading = false,
  loadingLabel = 'Working',
  onPress,
  type = 'button',
  variant = 'secondary',
}: LbButtonProps) => (
  <Button
    aria-busy={isLoading || undefined}
    className={className ? `lb-button ${className}` : 'lb-button'}
    data-lb-control
    data-lb-variant={variant}
    data-loading={isLoading || undefined}
    isDisabled={isDisabled}
    isPending={isLoading}
    type={type}
    {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
    {...(buttonRef ? { ref: buttonRef } : {})}
    {...(onPress ? { onPress } : {})}
  >
    <span aria-hidden={isLoading || undefined} className="lb-button-label">
      {children}
    </span>
    <span
      aria-hidden={!isLoading || undefined}
      className="lb-button-loading"
      data-visible={isLoading || undefined}
    >
      {loadingLabel}
    </span>
  </Button>
);

export interface LbIconButtonProps extends Omit<LbButtonProps, 'children'> {
  readonly icon: ReactNode;
  readonly label: string;
}

export const LbIconButton = ({ icon, label, ...buttonProps }: LbIconButtonProps) => (
  <TooltipTrigger delay={400}>
    <Button
      aria-label={label}
      className="lb-icon-button"
      data-lb-control
      data-lb-variant={buttonProps.variant ?? 'quiet'}
      type={buttonProps.type ?? 'button'}
      {...(buttonProps.isDisabled === undefined ? {} : { isDisabled: buttonProps.isDisabled })}
      {...(buttonProps.isLoading === undefined ? {} : { isPending: buttonProps.isLoading })}
      {...(buttonProps.onPress ? { onPress: buttonProps.onPress } : {})}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
    <Tooltip className="lb-tooltip">{label}</Tooltip>
  </TooltipTrigger>
);

export interface LbLinkProps {
  readonly children: ReactNode;
  readonly destinationKind?: 'internal' | 'external' | 'documentation';
  readonly href: string;
}

export const LbLink = ({ children, destinationKind = 'internal', href }: LbLinkProps) => (
  <Link
    className="lb-link"
    data-destination-kind={destinationKind}
    href={href}
    {...(destinationKind === 'external' ? { rel: 'noreferrer', target: '_blank' as const } : {})}
  >
    {children}
    {destinationKind === 'external' ? (
      <span className="lb-visually-hidden"> (opens in a new window)</span>
    ) : null}
  </Link>
);

interface LbFieldCopy {
  readonly description?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly label: string;
}

export interface LbTextFieldProps extends LbFieldCopy {
  readonly autoFocus?: boolean;
  readonly defaultValue?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly isRequired?: boolean;
  readonly isReadOnly?: boolean;
  readonly inputType?: 'email' | 'password' | 'text';
  readonly maxLength?: number;
  readonly name?: string;
  readonly onChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly value?: string;
}

const FieldCopy = ({ description, errorMessage }: Omit<LbFieldCopy, 'label'>) => (
  <>
    {description ? <Text slot="description">{description}</Text> : null}
    {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
  </>
);

export const LbTextField = ({
  description,
  errorMessage,
  inputType = 'text',
  label,
  maxLength,
  ...fieldProps
}: LbTextFieldProps) => (
  <TextField className="lb-field" {...fieldProps}>
    <Label>{label}</Label>
    <Input className="lb-input" data-lb-control maxLength={maxLength} type={inputType} />
    <FieldCopy description={description} errorMessage={errorMessage} />
  </TextField>
);

export const LbSearchField = ({
  description,
  errorMessage,
  label,
  maxLength,
  ...fieldProps
}: LbTextFieldProps) => (
  <SearchField className="lb-field" {...fieldProps}>
    <Label>{label}</Label>
    <Input className="lb-input" data-lb-control maxLength={maxLength} />
    <FieldCopy description={description} errorMessage={errorMessage} />
  </SearchField>
);

export const LbTextArea = ({
  description,
  errorMessage,
  label,
  maxLength,
  ...fieldProps
}: LbTextFieldProps) => (
  <TextField className="lb-field" {...fieldProps}>
    <Label>{label}</Label>
    <TextArea className="lb-input lb-text-area" data-lb-control maxLength={maxLength} />
    <FieldCopy description={description} errorMessage={errorMessage} />
  </TextField>
);

export interface LbChoiceProps {
  readonly children: ReactNode;
  readonly isDisabled?: boolean;
  readonly isSelected?: boolean;
  readonly onChange?: (selected: boolean) => void;
  readonly value?: string;
}

export const LbCheckbox = ({
  children,
  isDisabled = false,
  isSelected = false,
  onChange,
  value,
}: LbChoiceProps) => (
  <label
    className="lb-choice"
    data-disabled={isDisabled || undefined}
    data-lb-control
    data-selected={isSelected || undefined}
  >
    <input
      checked={isSelected}
      className="lb-choice-input"
      disabled={isDisabled}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      readOnly={onChange === undefined}
      type="checkbox"
      value={value}
    />
    <span aria-hidden="true" className="lb-choice-mark">
      {isSelected ? '✓' : ''}
    </span>
    {children}
  </label>
);

export interface LbRadioOption {
  readonly label: string;
  readonly value: string;
}

export interface LbRadioGroupProps {
  readonly label: string;
  readonly onChange?: (value: string) => void;
  readonly options: readonly LbRadioOption[];
  readonly value?: string;
}

export const LbRadioGroup = ({ label, options, ...props }: LbRadioGroupProps) => (
  <RadioGroup className="lb-choice-group" {...props}>
    <Label>{label}</Label>
    {options.map((option) => (
      <RadioField key={option.value} value={option.value}>
        <RadioButton className="lb-choice" data-lb-control>
          {({ isSelected }) => (
            <>
              <span aria-hidden="true" className="lb-radio-mark">
                {isSelected ? '●' : ''}
              </span>
              {option.label}
            </>
          )}
        </RadioButton>
      </RadioField>
    ))}
  </RadioGroup>
);

export interface LbSwitchProps {
  readonly children: ReactNode;
  readonly isDisabled?: boolean;
  readonly isSelected?: boolean;
  readonly onChange?: (selected: boolean) => void;
}

export const LbSwitch = ({ children, ...props }: LbSwitchProps) => (
  <SwitchField {...props}>
    <SwitchButton className="lb-switch" data-lb-control>
      {({ isSelected }) => (
        <>
          <span aria-hidden="true" className="lb-switch-track" data-selected={isSelected}>
            <span className="lb-switch-thumb" />
          </span>
          {children}
        </>
      )}
    </SwitchButton>
  </SwitchField>
);

export interface LbSliderProps {
  readonly label: string;
  readonly maxValue: number;
  readonly minValue: number;
  readonly onChange?: (value: number | number[]) => void;
  readonly step?: number;
  readonly value?: number | number[];
}

export const LbSlider = ({ label, ...props }: LbSliderProps) => (
  <Slider className="lb-slider" {...props}>
    <Label>{label}</Label>
    <SliderOutput />
    <SliderTrack className="lb-slider-track">
      {({ state }) => (
        <SliderThumb
          aria-label={label}
          className="lb-slider-thumb"
          data-lb-control
          index={0}
          style={{ insetInlineStart: `${String(state.getThumbPercent(0) * 100)}%` }}
        />
      )}
    </SliderTrack>
  </Slider>
);

export interface LbOption {
  readonly id: Key;
  readonly label: string;
}

interface LbCollectionFieldProps {
  readonly label: string;
  readonly onSelectionChange?: (key: Key | null) => void;
  readonly options: readonly LbOption[];
  readonly placeholder?: string;
  readonly selectedKey?: Key | null;
}

export const LbSelect = ({
  label,
  onSelectionChange,
  options,
  placeholder = 'Select an option',
  selectedKey,
}: LbCollectionFieldProps) => (
  <Select
    className="lb-field"
    placeholder={placeholder}
    {...(onSelectionChange ? { onSelectionChange } : {})}
    {...(selectedKey === undefined ? {} : { selectedKey })}
  >
    <Label>{label}</Label>
    <Button className="lb-input lb-select-trigger" data-lb-control>
      <SelectValue />
    </Button>
    <Popover className="lb-popover">
      <ListBox items={options}>
        {(option) => (
          <ListBoxItem className="lb-option" id={option.id} textValue={option.label}>
            {option.label}
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  </Select>
);

export const LbComboBox = ({
  label,
  onSelectionChange,
  options,
  placeholder = 'Search options',
  selectedKey,
}: LbCollectionFieldProps) => (
  <ComboBox
    className="lb-field"
    {...(onSelectionChange ? { onSelectionChange } : {})}
    {...(selectedKey === undefined ? {} : { selectedKey })}
  >
    <Label>{label}</Label>
    <Input className="lb-input" data-lb-control placeholder={placeholder} />
    <Button aria-label="Show options" className="lb-combo-trigger" data-lb-control>
      ▾
    </Button>
    <Popover className="lb-popover">
      <ListBox items={options}>
        {(option) => (
          <ListBoxItem className="lb-option" id={option.id} textValue={option.label}>
            {option.label}
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  </ComboBox>
);

export interface LbMenuItem {
  readonly id: Key;
  readonly isDisabled?: boolean;
  readonly label: string;
  readonly onAction: () => void;
}

export interface LbMenuProps {
  readonly items: readonly LbMenuItem[];
  readonly label: string;
}

export const LbMenu = ({ items, label }: LbMenuProps) => (
  <MenuTrigger>
    <Button className="lb-button" data-lb-control data-lb-variant="quiet">
      {label}
    </Button>
    <Popover className="lb-popover">
      <Menu aria-label={label} items={items}>
        {(item) => (
          <MenuItem
            className="lb-option"
            id={item.id}
            onAction={item.onAction}
            textValue={item.label}
            {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
          >
            {item.label}
          </MenuItem>
        )}
      </Menu>
    </Popover>
  </MenuTrigger>
);

export interface LbTab {
  readonly content: ReactNode;
  readonly id: Key;
  readonly label: string;
}

export interface LbTabsProps {
  readonly label: string;
  readonly onSelectionChange?: (key: Key) => void;
  readonly selectedKey?: Key;
  readonly tabs: readonly LbTab[];
}

export const LbTabs = ({ label, tabs, ...props }: LbTabsProps) => (
  <Tabs
    className="lb-tabs"
    {...(props.onSelectionChange ? { onSelectionChange: props.onSelectionChange } : {})}
    {...(props.selectedKey === undefined ? {} : { selectedKey: props.selectedKey })}
  >
    <TabList aria-label={label} items={tabs}>
      {(tab) => (
        <Tab className="lb-tab" id={tab.id}>
          {tab.label}
        </Tab>
      )}
    </TabList>
    <TabPanels items={tabs}>
      {(tab) => (
        <TabPanel className="lb-tab-panel" id={tab.id}>
          {tab.content}
        </TabPanel>
      )}
    </TabPanels>
  </Tabs>
);

export interface LbDialogContentProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
}

interface LbOverlayProps extends LbDialogContentProps {
  readonly isOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  readonly trigger: ReactNode;
}

export const LbDialogContent = ({ children, description, title }: LbDialogContentProps) => (
  <>
    <Heading slot="title">{title}</Heading>
    {description ? <Text slot="description">{description}</Text> : null}
    {children}
  </>
);

export interface LbDialogActionsProps {
  readonly children: ReactNode;
}

export const LbDialogActions = ({ children }: LbDialogActionsProps) => (
  <footer className="lb-dialog-actions">{children}</footer>
);

export const LbDialog = ({ isOpen, onOpenChange, trigger, ...dialogProps }: LbOverlayProps) => (
  <DialogTrigger
    {...(isOpen === undefined ? {} : { isOpen })}
    {...(onOpenChange ? { onOpenChange } : {})}
  >
    {trigger}
    <ModalOverlay className="lb-modal-overlay">
      <Modal className="lb-dialog">
        <Dialog>{() => <LbDialogContent {...dialogProps} />}</Dialog>
      </Modal>
    </ModalOverlay>
  </DialogTrigger>
);

export const LbAlertDialog = ({
  isOpen,
  onOpenChange,
  trigger,
  ...dialogProps
}: LbOverlayProps) => (
  <DialogTrigger
    {...(isOpen === undefined ? {} : { isOpen })}
    {...(onOpenChange ? { onOpenChange } : {})}
  >
    {trigger}
    <ModalOverlay className="lb-modal-overlay">
      <Modal className="lb-dialog" isDismissable={false}>
        <Dialog role="alertdialog">{() => <LbDialogContent {...dialogProps} />}</Dialog>
      </Modal>
    </ModalOverlay>
  </DialogTrigger>
);

export const LbSheet = ({ isOpen, onOpenChange, trigger, ...dialogProps }: LbOverlayProps) => (
  <DialogTrigger
    {...(isOpen === undefined ? {} : { isOpen })}
    {...(onOpenChange ? { onOpenChange } : {})}
  >
    {trigger}
    <Popover className="lb-sheet" placement="end">
      <Dialog>{() => <LbDialogContent {...dialogProps} />}</Dialog>
    </Popover>
  </DialogTrigger>
);

export interface LbTooltipProps {
  readonly children: ReactNode;
  readonly content: ReactNode;
}

export const LbTooltip = ({ children, content }: LbTooltipProps) => (
  <TooltipTrigger delay={400}>
    {children}
    <Tooltip className="lb-tooltip">{content}</Tooltip>
  </TooltipTrigger>
);

export interface LbProgressProps {
  readonly label: string;
  readonly maxValue?: number;
  readonly value?: number;
}

export const LbProgress = ({ label, maxValue, value }: LbProgressProps) => (
  <ProgressBar
    aria-label={label}
    className="lb-progress"
    isIndeterminate={value === undefined || maxValue === undefined}
    {...(maxValue === undefined ? {} : { maxValue })}
    {...(value === undefined ? {} : { value })}
  >
    {({ percentage, valueText }) => (
      <>
        <span>{label}</span>
        <span>{valueText}</span>
        <span aria-hidden="true" className="lb-progress-track">
          <span
            className="lb-progress-fill"
            style={{ inlineSize: `${String(percentage ?? 0)}%` }}
          />
        </span>
      </>
    )}
  </ProgressBar>
);

export type LbOperationalNoticeState =
  'reconnecting' | 'stale' | 'offline' | 'degraded' | 'conflict' | 'rate-limit';

const operationalNoticePresentation = Object.freeze({
  conflict: Object.freeze({ icon: '!', pattern: 'double', tone: 'critical' }),
  degraded: Object.freeze({ icon: '!', pattern: 'dashed', tone: 'critical' }),
  offline: Object.freeze({ icon: '×', pattern: 'dotted', tone: 'critical' }),
  'rate-limit': Object.freeze({ icon: '⌛', pattern: 'dotted', tone: 'warning' }),
  reconnecting: Object.freeze({ icon: '↻', pattern: 'dashed', tone: 'warning' }),
  stale: Object.freeze({ icon: '◷', pattern: 'dotted', tone: 'warning' }),
} satisfies Record<
  LbOperationalNoticeState,
  Readonly<{ icon: string; pattern: string; tone: string }>
>);

export interface LbOperationalNoticeProps {
  readonly action?: ReactNode;
  readonly detail: ReactNode;
  readonly state: LbOperationalNoticeState;
  readonly title: ReactNode;
}

export const LbOperationalNotice = ({ action, detail, state, title }: LbOperationalNoticeProps) => {
  const presentation = operationalNoticePresentation[state];
  const urgent = state === 'offline' || state === 'degraded' || state === 'conflict';

  return (
    <section
      aria-live={urgent ? 'assertive' : 'polite'}
      className="lb-operational-notice"
      data-lb-region
      data-pattern={presentation.pattern}
      data-state={state}
      data-tone={presentation.tone}
      role={urgent ? 'alert' : 'status'}
    >
      <span aria-hidden="true" className="lb-operational-notice-icon">
        {presentation.icon}
      </span>
      <span className="lb-operational-notice-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      {action ? <span className="lb-operational-notice-action">{action}</span> : null}
    </section>
  );
};

export interface LbInspectorProps {
  readonly children: ReactNode;
  readonly label: string;
  readonly onClose: () => void;
  readonly title: ReactNode;
}

export const LbInspector = ({ children, label, onClose, title }: LbInspectorProps) => (
  <aside aria-label={label} className="lb-context-inspector" data-lb-region tabIndex={-1}>
    <header className="lb-context-inspector-header">
      <h2>{title}</h2>
      <LbIconButton icon="×" label={`Close ${label}`} onPress={onClose} />
    </header>
    <div className="lb-context-inspector-content">{children}</div>
  </aside>
);

export interface LbCommand {
  readonly description: ReactNode;
  readonly id: string;
  readonly label: ReactNode;
}

export interface LbCommandSearchProps {
  readonly commands: readonly LbCommand[];
  readonly label: string;
  readonly onCommand: (commandId: string) => void;
  readonly onQueryChange?: (query: string) => void;
  readonly query?: string;
}

export const LbCommandSearch = ({
  commands,
  label,
  onCommand,
  onQueryChange,
  query,
}: LbCommandSearchProps) => (
  <form
    className="lb-command-search"
    role="search"
    onSubmit={(event) => {
      event.preventDefault();
    }}
  >
    <LbSearchField
      label={label}
      {...(onQueryChange ? { onChange: onQueryChange } : {})}
      {...(query === undefined ? {} : { value: query })}
    />
    <ul aria-label="Admin command results" className="lb-command-list">
      {commands.map((command) => (
        <li key={command.id}>
          <Button
            className="lb-command"
            data-lb-control
            onPress={() => {
              onCommand(command.id);
            }}
            type="button"
          >
            <strong>{command.label}</strong>
            <span>{command.description}</span>
          </Button>
        </li>
      ))}
    </ul>
  </form>
);

export type LbRiskLevel = 'low' | 'elevated' | 'critical';

const riskPresentation = Object.freeze({
  critical: Object.freeze({ label: 'Critical risk', pattern: 'double', tone: 'critical' }),
  elevated: Object.freeze({ label: 'Elevated risk', pattern: 'dashed', tone: 'warning' }),
  low: Object.freeze({ label: 'Low risk', pattern: 'solid', tone: 'success' }),
} satisfies Record<LbRiskLevel, Readonly<{ label: string; pattern: string; tone: string }>>);

export interface LbRiskReviewProps {
  readonly action?: ReactNode;
  readonly consequences: readonly ReactNode[];
  readonly level: LbRiskLevel;
  readonly title: ReactNode;
}

export const LbRiskReview = ({ action, consequences, level, title }: LbRiskReviewProps) => {
  const presentation = riskPresentation[level];

  return (
    <section
      aria-label={presentation.label}
      className="lb-risk-review"
      data-lb-region
      data-pattern={presentation.pattern}
      data-tone={presentation.tone}
    >
      <header>
        <span aria-hidden="true" className="lb-risk-review-icon">
          {level === 'critical' ? '!' : '◇'}
        </span>
        <span>
          <strong>{presentation.label}</strong>
          <h2>{title}</h2>
        </span>
      </header>
      <ul>
        {consequences.map((consequence, index) => (
          <li key={index}>{consequence}</li>
        ))}
      </ul>
      {action ? <footer>{action}</footer> : null}
    </section>
  );
};

export interface LbSkeletonProps {
  readonly blockSize?: string;
  readonly inlineSize?: string;
}

export const LbSkeleton = ({
  blockSize = 'var(--lb-row-standard-size)',
  inlineSize = '100%',
}: LbSkeletonProps) => (
  <div aria-hidden="true" className="lb-skeleton" style={{ blockSize, inlineSize }} />
);

export type LbPanelTone = 'tonal' | 'focal';

export interface LbPanelProps {
  readonly children: ReactNode;
  readonly label: string;
  readonly tone?: LbPanelTone;
}

export const LbPanel = ({ children, label, tone = 'tonal' }: LbPanelProps) => (
  <section aria-label={label} className="lb-material-panel" data-lb-region data-material={tone}>
    {children}
  </section>
);

export interface LbRowListProps {
  readonly children: ReactNode;
  readonly label: string;
}

export const LbRowList = ({ children, label }: LbRowListProps) => (
  <ul aria-label={label} className="lb-row-list" role="list">
    {children}
  </ul>
);

export interface LbDetailRowProps {
  readonly detail?: ReactNode;
  readonly label: ReactNode;
  readonly value: ReactNode;
}

export const LbDetailRow = ({ detail, label, value }: LbDetailRowProps) => (
  <li className="lb-detail-row" data-material="row" role="listitem">
    <span className="lb-detail-row-label">{label}</span>
    <strong className="lb-detail-row-value">{value}</strong>
    {detail ? <span className="lb-detail-row-detail">{detail}</span> : null}
  </li>
);

export interface LbDataTableColumn {
  readonly id: string;
  readonly label: ReactNode;
}

export interface LbDataTableRow {
  readonly cells: Readonly<Record<string, ReactNode>>;
  readonly id: string;
}

export interface LbDataTableProps {
  readonly caption: string;
  readonly columns: readonly LbDataTableColumn[];
  readonly density?: 'comfortable' | 'compact';
  readonly onRowOpen?: (rowId: string) => void;
  readonly rows: readonly LbDataTableRow[];
  readonly selectedRowId?: string;
}

export const LbDataTable = ({
  caption,
  columns,
  density = 'comfortable',
  onRowOpen,
  rows,
  selectedRowId,
}: LbDataTableProps) => (
  <div className="lb-table-viewport" data-density={density} data-lb-region>
    <table className="lb-data-table" data-density={density}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            aria-label={onRowOpen ? `Open row ${row.id}` : undefined}
            aria-selected={selectedRowId === row.id || undefined}
            data-selected={selectedRowId === row.id || undefined}
            key={row.id}
            onClick={
              onRowOpen
                ? () => {
                    onRowOpen(row.id);
                  }
                : undefined
            }
            onKeyDown={
              onRowOpen
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowOpen(row.id);
                    }
                  }
                : undefined
            }
            tabIndex={onRowOpen ? 0 : undefined}
          >
            {columns.map((column) => (
              <td key={column.id}>{row.cells[column.id]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export interface LbSkeletonRegionProps {
  readonly label: string;
  readonly rows?: number;
}

export const LbSkeletonRegion = ({ label, rows = 3 }: LbSkeletonRegionProps) => (
  <div aria-label={label} className="lb-skeleton-region" data-lb-region role="status">
    <span className="lb-visually-hidden">{label}</span>
    {Array.from({ length: rows }, (_, index) => (
      <LbSkeleton key={index} />
    ))}
  </div>
);

export interface LbDisclosureProps {
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly label: string;
}

export const LbDisclosure = ({ children, defaultOpen = false, label }: LbDisclosureProps) => (
  <details className="lb-disclosure" data-lb-region open={defaultOpen || undefined}>
    <summary data-lb-control>{label}</summary>
    <div className="lb-disclosure-content">{children}</div>
  </details>
);
