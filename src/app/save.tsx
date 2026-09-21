import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/button";
import { PreviewImage } from "@/components/preview-image";
import { ReminderPicker } from "@/components/reminder-picker";
import { ScreenHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { AppText } from "@/components/text";
import { findSavedItemByUrl } from "@/db/repositories";
import { scheduleReminder } from "@/features/reminders/scheduler";
import { useLivePreview } from "@/features/saved-items/use-live-preview";
import { parseInstagramUrl } from "@/services/instagram/parse-url";
import { getDatabase, useLibraryStore } from "@/stores/library";
import type { SavedItem } from "@/types/domain";
import { displayCaption } from "@/features/tags/hashtags";
import { cn } from "@/utils/cn";

type SaveParams = {
  /** A URL handed over by the share sheet, or typed by the user. */
  url?: string;
  /** Raw share text that did not contain an Instagram link. */
  rejected?: string;
};

export default function SaveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<SaveParams>();

  const collections = useLibraryStore((state) => state.collections);
  const addItem = useLibraryStore((state) => state.addItem);
  const addCollection = useLibraryStore((state) => state.addCollection);
  const refresh = useLibraryStore((state) => state.refresh);
  const notificationSound = useLibraryStore(
    (state) => state.settings.notificationSound,
  );

  const [rawUrl, setRawUrl] = useState(params.url ?? "");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [duplicateLookup, setDuplicateLookup] = useState<{
    url: string;
    item: SavedItem | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseInstagramUrl(rawUrl), [rawUrl]);
  const preview = useLivePreview(parsed.normalizedUrl);

  // The lookup result only counts for the URL it was made for, so a stale result from a
  // previous URL is ignored without having to clear state as the input changes.
  const duplicate =
    parsed.normalizedUrl && duplicateLookup?.url === parsed.normalizedUrl
      ? duplicateLookup.item
      : null;

  const canSave = parsed.isValid && !saving && duplicate === null;

  // Warn about an item already saved from the same URL rather than creating a second copy.
  useEffect(() => {
    const normalizedUrl = parsed.normalizedUrl;
    if (!normalizedUrl) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const db = await getDatabase();
      const existing = await findSavedItemByUrl(db, normalizedUrl);
      if (!cancelled) {
        setDuplicateLookup({ url: normalizedUrl, item: existing });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed.normalizedUrl]);

  const onCreateCollection = useCallback(async () => {
    const created = await addCollection({ name: newCollectionName });
    if (created) {
      setCollectionId(created.id);
    }
    setNewCollectionName("");
    setIsAddingCollection(false);
  }, [addCollection, newCollectionName]);

  const onSave = useCallback(async () => {
    if (!parsed.isValid || !parsed.normalizedUrl) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Reuse what the live preview already resolved, so the item looks complete at once.
      // It stays `pending` so the queue still downloads and caches the thumbnail locally.
      const item = await addItem({
        instagramUrl: parsed.normalizedUrl,
        instagramShortcode: parsed.shortcode,
        mediaType:
          preview.data?.mediaType ??
          (parsed.type === "reel" ? "video" : "unknown"),
        authorUsername: preview.data?.authorUsername,
        caption: preview.data?.caption,
        thumbnailUrl: preview.data?.thumbnailUrl,
        collectionId: collectionId ?? undefined,
      });

      if (reminderAt) {
        const db = await getDatabase();
        await scheduleReminder(db, item.id, reminderAt, {
          sound: notificationSound,
        });
        await refresh();
      }

      router.replace({ pathname: "/item/[id]", params: { id: item.id } });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this item.",
      );
      setSaving(false);
    }
  }, [
    addItem,
    collectionId,
    notificationSound,
    parsed,
    preview.data,
    refresh,
    reminderAt,
    router,
  ]);

  const previewItem: Pick<
    SavedItem,
    "previewStatus" | "cachedThumbnailPath" | "thumbnailUrl" | "mediaType"
  > = {
    previewStatus: preview.loading
      ? "pending"
      : preview.data
        ? "available"
        : "failed",
    thumbnailUrl: preview.data?.thumbnailUrl,
    mediaType:
      preview.data?.mediaType ?? (parsed.type === "reel" ? "video" : "unknown"),
  };

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader
        title="Save"
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 pt-2 items-center">
            <PreviewImage
              item={previewItem}
              size="detail"
              className="w-full aspect-post rounded-3xl"
            />
            {preview.data?.authorUsername || preview.data?.caption ? (
              <View className="self-stretch pt-3 gap-1">
                {preview.data.authorUsername ? (
                  <AppText variant="bodyStrong">
                    @{preview.data.authorUsername}
                  </AppText>
                ) : null}
                {preview.data.caption ? (
                  <AppText variant="caption" numberOfLines={3}>
                    {displayCaption(preview.data.caption)}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {parsed.isValid && (preview.loading || !preview.data?.thumbnailUrl) ? (
              <AppText variant="caption" className="pt-3 text-center">
                {preview.loading
                  ? "Loading preview. You can save now."
                  : "Preview unavailable. You can still save this link."}
              </AppText>
            ) : null}
          </View>

          {params.rejected && !parsed.isValid ? (
            <View className="mx-5 rounded-2xl bg-surface border border-border p-4 gap-1">
              <AppText variant="bodyStrong">
                That share was not an Instagram post
              </AppText>
              <AppText variant="caption">
                Share a post or reel from Instagram, or paste its link below.
              </AppText>
            </View>
          ) : null}

          <View className="gap-2">
            <SectionHeader title="Instagram link" className="px-5" />
            <View className="px-5">
              <TextInput
                value={rawUrl}
                onChangeText={setRawUrl}
                placeholder="https://www.instagram.com/p/..."
                placeholderTextColorClassName="accent-ink-faint"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Instagram link"
                selectionColorClassName="accent-accent"
                className={cn(
                  "h-12 px-4 rounded-xl bg-surface border text-ink",
                  rawUrl.length > 0 && !parsed.isValid
                    ? "border-danger"
                    : "border-border",
                )}
              />
              {rawUrl.length > 0 && !parsed.isValid ? (
                <AppText variant="caption" className="pt-2 text-danger">
                  That is not an Instagram post or reel link.
                </AppText>
              ) : null}
              {duplicate ? (
                <View className="pt-3 gap-2">
                  <AppText variant="caption" className="text-warning">
                    You already saved this one.
                  </AppText>
                  <Button
                    label="Open the saved item"
                    variant="secondary"
                    onPress={() =>
                      router.replace({
                        pathname: "/item/[id]",
                        params: { id: duplicate.id },
                      })
                    }
                  />
                </View>
              ) : null}
            </View>
          </View>

          <View className="gap-2">
            <SectionHeader title="Collection" className="px-5" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-5"
            >
              <CollectionChip
                label="All saved"
                selected={collectionId === null}
                onPress={() => setCollectionId(null)}
              />
              {collections.map((collection) => (
                <CollectionChip
                  key={collection.id}
                  label={collection.name}
                  selected={collectionId === collection.id}
                  onPress={() => setCollectionId(collection.id)}
                />
              ))}
              <CollectionChip
                label="+ Add"
                selected={false}
                onPress={() => setIsAddingCollection((value) => !value)}
              />
            </ScrollView>

            {isAddingCollection ? (
              <View className="px-5 flex-row gap-2">
                <TextInput
                  value={newCollectionName}
                  onChangeText={setNewCollectionName}
                  placeholder="Collection name"
                  placeholderTextColorClassName="accent-ink-faint"
                  accessibilityLabel="New collection name"
                  selectionColorClassName="accent-accent"
                  autoFocus
                  onSubmitEditing={onCreateCollection}
                  className="flex-1 h-11 px-4 rounded-xl bg-surface border border-border text-ink"
                />
                <Button
                  label="Create"
                  onPress={onCreateCollection}
                  disabled={newCollectionName.trim().length === 0}
                />
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <SectionHeader title="Remind me" className="px-5" />
            <ReminderPicker value={reminderAt} onChange={setReminderAt} />
          </View>

          {error ? (
            <AppText variant="caption" className="px-5 text-danger">
              {error}
            </AppText>
          ) : null}
        </ScrollView>

        <View className="px-5 pb-safe-offset-4 pt-2 border-t border-border bg-canvas">
          <Button
            label="Save item"
            size="lg"
            loading={saving}
            disabled={!canSave}
            onPress={onSave}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function CollectionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        "h-10 px-4 rounded-full items-center justify-center border active:opacity-70",
        selected ? "bg-accent border-accent" : "bg-surface border-border",
      )}
    >
      <AppText
        variant="captionStrong"
        className={selected ? "text-on-accent" : "text-ink"}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
