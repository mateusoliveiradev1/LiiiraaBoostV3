import type { ReactNode } from 'react';
import {
  Button,
  CheckboxButton,
  CheckboxField,
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

export interface LbButtonProps {
  readonly children: ReactNode;
  readonly isDisabled?: boolean;
  readonly isLoading?: boolean;
  readonly loadingLabel?: string;
  readonly onPress?: () => void;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly variant?: LbButtonVariant;
}

export const LbButton = ({
  children,
  isDisabled = false,
  isLoading = false,
  loadingLabel = 'Working',
  onPress,
  type = 'button',
  variant = 'secondary',
}: LbButtonProps) => (
  <Button
    className="lb-button"
    data-lb-control
    data-lb-variant={variant}
    isDisabled={isDisabled}
    isPending={isLoading}
    type={type}
    {...(onPress ? { onPress } : {})}
  >
    {isLoading ? loadingLabel : children}
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
  label,
  ...fieldProps
}: LbTextFieldProps) => (
  <TextField className="lb-field" {...fieldProps}>
    <Label>{label}</Label>
    <Input className="lb-input" data-lb-control />
    <FieldCopy description={description} errorMessage={errorMessage} />
  </TextField>
);

export const LbSearchField = ({
  description,
  errorMessage,
  label,
  ...fieldProps
}: LbTextFieldProps) => (
  <SearchField className="lb-field" {...fieldProps}>
    <Label>{label}</Label>
    <Input className="lb-input" data-lb-control />
    <FieldCopy description={description} errorMessage={errorMessage} />
  </SearchField>
);

export const LbTextArea = ({
  description,
  errorMessage,
  label,
  ...fieldProps
}: LbTextFieldProps) => (
  <TextField className="lb-field" {...fieldProps}>
    <Label>{label}</Label>
    <TextArea className="lb-input lb-text-area" data-lb-control />
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

export const LbCheckbox = ({ children, ...props }: LbChoiceProps) => (
  <CheckboxField {...props}>
    <CheckboxButton className="lb-choice" data-lb-control>
      {({ isSelected }) => (
        <>
          <span aria-hidden="true" className="lb-choice-mark">
            {isSelected ? '✓' : ''}
          </span>
          {children}
        </>
      )}
    </CheckboxButton>
  </CheckboxField>
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
