import React from "react";
import { Modal, Pressable, View } from "react-native";
import { AppText } from "@/src/components/ui";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES, LangCode } from "@/src/i18n/translations";

export function LanguageModal({
  visible,
  onClose,
  current,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  current: LangCode;
  onSelect: (code: LangCode) => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.xl,
            padding: 16,
            gap: 6,
          }}
        >
          <AppText variant="h3" style={{ marginBottom: 6 }}>
            {t("profile.language")}
          </AppText>
          {LANGUAGES.map((l) => {
            const active = current === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => onSelect(l.code)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: theme.radius.md,
                  backgroundColor: active ? theme.colors.surfaceAlt : "transparent",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <AppText variant="h3">{l.flag}</AppText>
                  <AppText variant="body">{l.label}</AppText>
                </View>
                {active ? (
                  <AppText variant="small" color={theme.colors.primary} style={{ fontWeight: "700" }}>
                    ✓
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
