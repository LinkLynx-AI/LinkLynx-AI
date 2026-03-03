export type ButtonStyle = "primary" | "secondary" | "success" | "danger" | "link";

export interface ButtonComponent {
  type: 2;
  style: ButtonStyle;
  label?: string;
  emoji?: { id: string | null; name: string; animated: boolean };
  customId?: string;
  url?: string;
  disabled?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { id: string | null; name: string; animated: boolean };
  default?: boolean;
}

export interface SelectMenuComponent {
  type: 3;
  customId: string;
  placeholder?: string;
  options: SelectOption[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export interface TextInputComponent {
  type: 4;
  customId: string;
  style: "short" | "paragraph";
  label: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

export type SelectMenuType = 3 | 5 | 6 | 7 | 8;

export interface UserSelectComponent {
  type: 5;
  customId: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export interface RoleSelectComponent {
  type: 6;
  customId: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export interface ChannelSelectComponent {
  type: 8;
  customId: string;
  placeholder?: string;
  channelTypes?: number[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
}

export interface ActionRow {
  type: 1;
  components: (
    | ButtonComponent
    | SelectMenuComponent
    | UserSelectComponent
    | RoleSelectComponent
    | ChannelSelectComponent
  )[];
}

export interface BotModalForm {
  customId: string;
  title: string;
  components: {
    type: 1;
    components: TextInputComponent[];
  }[];
}

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  botName: string;
  botAvatar?: string;
  options?: SlashCommandOption[];
}

export interface SlashCommandOption {
  name: string;
  description: string;
  type: "string" | "integer" | "boolean" | "user" | "channel" | "role";
  required?: boolean;
}
