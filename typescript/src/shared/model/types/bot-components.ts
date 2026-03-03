export type ButtonStyle = "primary" | "secondary" | "success" | "danger" | "link";

export type ButtonComponent = {
  type: 2;
  style: ButtonStyle;
  label?: string;
  emoji?: { id: string | null; name: string; animated: boolean };
  customId?: string;
  url?: string;
  disabled?: boolean;
};

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
  emoji?: { id: string | null; name: string; animated: boolean };
  default?: boolean;
};

export type SelectMenuComponent = {
  type: 3;
  customId: string;
  placeholder?: string;
  options: SelectOption[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
};

export type TextInputComponent = {
  type: 4;
  customId: string;
  style: "short" | "paragraph";
  label: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

export type SelectMenuType = 3 | 5 | 6 | 7 | 8;

export type UserSelectComponent = {
  type: 5;
  customId: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
};

export type RoleSelectComponent = {
  type: 6;
  customId: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
};

export type ChannelSelectComponent = {
  type: 8;
  customId: string;
  placeholder?: string;
  channelTypes?: number[];
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
};

export type ActionRow = {
  type: 1;
  components: (
    | ButtonComponent
    | SelectMenuComponent
    | UserSelectComponent
    | RoleSelectComponent
    | ChannelSelectComponent
  )[];
};

export type BotModalForm = {
  customId: string;
  title: string;
  components: {
    type: 1;
    components: TextInputComponent[];
  }[];
};

export type SlashCommand = {
  id: string;
  name: string;
  description: string;
  botName: string;
  botAvatar?: string;
  options?: SlashCommandOption[];
};

export type SlashCommandOption = {
  name: string;
  description: string;
  type: "string" | "integer" | "boolean" | "user" | "channel" | "role";
  required?: boolean;
};
