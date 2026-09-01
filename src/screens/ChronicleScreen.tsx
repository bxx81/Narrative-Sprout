import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import MainText from "../components/ui/MainText";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { ROUTES } from "../app/routes";
import { useLazyNodeImage } from "../hooks/useLazyNodeImage";
import BackButton from "../components/ui/BackButton";
import { collectAncestors } from "../features/storytree/api";
import type { StoryNodeRecord } from "../types";

/**
 * A single node card in the branch chronicle view.
 */
const ChronicleNode: React.FC<{
  node: StoryNodeRecord;
  choiceText: string | null;
  branchEndNodeId: string;
}> = React.memo(({ node, choiceText, branchEndNodeId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const resumeStoryAtNode = useGameStore((s) => s.resumeStoryAtNode);
  const { elementRef, imageUrl, isLoading } = useLazyNodeImage(node.id);

  // Legacy rewind semantics: the playhead stays at the branch end the
  // chronicle is showing, so Forward from here walks back toward it.
  const handleRewind = () => {
    resumeStoryAtNode(node.id, branchEndNodeId);
    navigate(ROUTES.PLAY, { viewTransition: true });
  };

  return (
    <article
      ref={elementRef}
      className="text-bg-color mb-6 max-w-2xl rounded-lg p-4 shadow-md select-text sm:p-6 md:min-w-[20rem]"
    >
      <figure className="mb-4 overflow-hidden rounded-lg">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <img
            src={imageUrl || undefined}
            alt={node.scene.imagePrompt}
            className="h-full w-full cursor-pointer object-cover"
            onClick={handleRewind}
          />
        )}
      </figure>
      <figcaption>
        <div className="font-serif-display mb-4 [line-break:strict]">
          <MainText text={node.scene.sceneText} />
          {node.scene.isStoryOver && node.scene.storyClosingText && (
            <MainText text={node.scene.storyClosingText} className="mt-4 font-bold" />
          )}
        </div>
        <Button onClick={handleRewind} intent="primary" size="medium">
          {t("historyContinueButton")}
        </Button>
        {choiceText && (
          <div className="border-text-border mt-6 border-t border-dashed pt-4 text-center">
            <p className="support-text-color text-sm">{t("historyChoicePrefix")}</p>
            <p className="font-semibold">{`"${choiceText}"`}</p>
          </div>
        )}
      </figcaption>
    </article>
  );
});
ChronicleNode.displayName = "ChronicleNode";

/**
 * The chronicle screen: the full path from the story's beginning to the
 * selected ending node.
 */
const ChronicleScreen: React.FC = () => {
  const { t } = useTranslation();
  const nodes = useGameStore((s) => s.nodes);
  const chronicleTargetNodeId = useGameStore((s) => s.chronicleTargetNodeId);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // collectAncestors returns target-first; chronicle renders root-first.
  const branchPath = useMemo(() => {
    if (!chronicleTargetNodeId) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return collectAncestors(byId, chronicleTargetNodeId, true).reverse();
  }, [nodes, chronicleTargetNodeId]);

  if (!chronicleTargetNodeId) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <LoadingSpinner />
        <p className="font-serif-display mt-4 text-lg">{t("loadingHistory")}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto mb-20 max-w-384">
      <header className="text-center">
        <h1 className="font-serif-display text-3xl font-bold md:text-4xl">{t("chronicleTitle")}</h1>
        <p className="support-text-color mx-auto my-2 max-w-3xl text-lg">
          {t("chronicleDescription")}
        </p>
      </header>

      <section className="mx-auto max-w-2xl">
        {branchPath.map((node, index) => {
          const nextNode = branchPath[index + 1];
          return (
            <ChronicleNode
              key={node.id}
              node={node}
              choiceText={nextNode?.choiceText ?? null}
              branchEndNodeId={chronicleTargetNodeId}
            />
          );
        })}
      </section>

      <BackButton />
    </main>
  );
};

export default ChronicleScreen;
