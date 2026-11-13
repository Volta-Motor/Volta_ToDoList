/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { copyTextToClipboard, generateWorkItemLink } from "@plane/utils";
// components
import { FilterChip } from "@/components/general-board/filter-chip";
import { GROUP_COLORS } from "@/components/general-board/palette";
import { getProjectTag, ProjectTag } from "@/components/general-board/project-tag";
import { useStoryPoints } from "@/components/story-points/use-story-points";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
// local imports
import { getReportMonths, useActivityReport } from "./use-activity-report";

const ALL = "all";

type Props = {
  workspaceSlug: string;
};

export const ActivityReportsRoot = observer(function ActivityReportsRoot(props: Props) {
  const { workspaceSlug } = props;
  // store hooks
  const { joinedProjectIds, getProjectById } = useProject();
  const { getUserDetails } = useMember();
  // translation
  const { t, currentLocale } = useTranslation();
  // state
  const months = useMemo(() => getReportMonths(), []);
  const [monthKey, setMonthKey] = useState<string>(months[0].key);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  // derived values
  const reportMonth = months.find((month) => month.key === monthKey) ?? months[0];
  const isCurrentMonth = reportMonth.key === months[0].key;
  const { completed, inProgress, isTruncated, isLoading, hasError } = useActivityReport(
    workspaceSlug,
    reportMonth,
    isCurrentMonth
  );
  const { getStoryPoints, sumStoryPoints } = useStoryPoints(workspaceSlug);

  const monthLabel = (year: number, month: number) =>
    new Intl.DateTimeFormat(currentLocale, { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  const formatDate = (value: string | null | undefined) =>
    value
      ? new Intl.DateTimeFormat(currentLocale, { day: "2-digit", month: "short", year: "numeric" }).format(
          new Date(value)
        )
      : "";

  const projects = useMemo(
    () =>
      sortBy(
        joinedProjectIds.map((projectId) => getProjectById(projectId)).filter((project) => project !== undefined),
        (project) => project.identifier
      ),
    [joinedProjectIds, getProjectById]
  );

  const getKey = (item: TIssue) => `${getProjectById(item.project_id)?.identifier ?? ""}-${item.sequence_id}`;
  /** Text added to a report line for the story points of a work item (empty when it has none). */
  const getPointsText = (item: TIssue) => {
    const points = getStoryPoints(item);
    return points === undefined ? "" : `, ${t("story_points.value", { points })}`;
  };
  const getAssignees = (item: TIssue) =>
    (item.assignee_ids ?? [])
      .map((id) => getUserDetails(id)?.display_name)
      .filter((name) => name !== undefined)
      .join(", ") || t("activity_reports.unassigned");

  // one block per project that has something to report, in identifier order
  const sections = projects
    .map((project, index) => ({
      project,
      tag: getProjectTag(project.identifier, index),
      completed: completed.filter((item) => item.project_id === project.id),
      inProgress: inProgress.filter((item) => item.project_id === project.id),
    }))
    .filter(
      (section) =>
        (projectFilter === ALL || section.project.id === projectFilter) &&
        section.completed.length + section.inProgress.length > 0
    );
  const completedCount = sections.reduce((total, section) => total + section.completed.length, 0);
  const inProgressCount = sections.reduce((total, section) => total + section.inProgress.length, 0);
  const completedPoints = sections.reduce((total, section) => total + sumStoryPoints(section.completed), 0);

  const buildReportText = () => {
    const lines: string[] = [
      t("activity_reports.text.heading", { month: monthLabel(reportMonth.year, reportMonth.month) }),
      "",
    ];
    sections.forEach((section) => {
      lines.push(`${section.project.name} (${section.project.identifier})`);
      if (section.completed.length > 0) {
        lines.push(t("activity_reports.completed"));
        section.completed.forEach((item) =>
          lines.push(
            `- ${getKey(item)} ${item.name} (${getAssignees(item)}, ${formatDate(item.completed_at)}${getPointsText(item)})`
          )
        );
      }
      if (section.inProgress.length > 0) {
        lines.push(t("activity_reports.in_progress"));
        section.inProgress.forEach((item) =>
          lines.push(`- ${getKey(item)} ${item.name} (${getAssignees(item)}${getPointsText(item)})`)
        );
      }
      lines.push("");
    });
    return lines.join("\n").trimEnd();
  };

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(buildReportText());
      setToast({
        type: "success",
        title: t("activity_reports.copied.title"),
        message: t("activity_reports.copied.message"),
      });
    } catch {
      setToast({
        type: "error",
        title: t("activity_reports.copy_failed.title"),
        message: t("activity_reports.copy_failed.message"),
      });
    }
  };

  const renderRows = (items: TIssue[], showCompletedDate: boolean) => (
    <ul className="flex flex-col">
      {items.map((item) => {
        const project = getProjectById(item.project_id);
        return (
          <li
            key={item.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-subtle py-2 text-body-sm-regular"
          >
            <span className="w-20 flex-shrink-0 text-caption-sm-regular text-tertiary">{getKey(item)}</span>
            <Link
              href={generateWorkItemLink({
                workspaceSlug,
                projectId: item.project_id,
                issueId: item.id,
                projectIdentifier: project?.identifier,
                sequenceId: item.sequence_id,
              })}
              className="min-w-0 flex-1 text-primary hover:text-accent-primary hover:underline"
            >
              {item.name}
            </Link>
            {getStoryPoints(item) !== undefined && (
              <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-caption-sm-semibold whitespace-nowrap text-accent-primary">
                {t("story_points.value", { points: getStoryPoints(item) })}
              </span>
            )}
            <span className="text-caption-sm-regular text-secondary">{getAssignees(item)}</span>
            {showCompletedDate && (
              <span className="w-24 text-right text-caption-sm-regular whitespace-nowrap text-tertiary">
                {formatDate(item.completed_at)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex flex-shrink-0 flex-col gap-3 border-b border-subtle px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="activity-report-month" className="text-caption-md-medium text-tertiary">
            {t("activity_reports.period")}
          </label>
          <select
            id="activity-report-month"
            value={monthKey}
            onChange={(event) => setMonthKey(event.target.value)}
            className="h-8 rounded-md border border-strong bg-surface-1 px-2 text-body-sm-medium text-primary"
          >
            {months.map((month) => (
              <option key={month.key} value={month.key}>
                {monthLabel(month.year, month.month)}
              </option>
            ))}
          </select>
          <span className="text-body-sm-regular text-secondary">
            {t("activity_reports.summary", { completed: completedCount, in_progress: inProgressCount })}
            {completedPoints > 0 && ` · ${t("story_points.completed_total", { points: completedPoints })}`}
          </span>
          <div className="ml-auto">
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              label={t("activity_reports.copy")}
              onClick={() => void handleCopy()}
              disabled={sections.length === 0}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("activity_reports.project")}>
          <span className="w-14 text-caption-md-medium text-tertiary">{t("activity_reports.project")}</span>
          <FilterChip isSelected={projectFilter === ALL} onClick={() => setProjectFilter(ALL)}>
            {t("activity_reports.all")}
          </FilterChip>
          {projects.map((project, index) => (
            <FilterChip
              key={project.id}
              isSelected={projectFilter === project.id}
              onClick={() => setProjectFilter(project.id)}
            >
              <ProjectTag tag={getProjectTag(project.identifier, index)} />
              {project.name}
            </FilterChip>
          ))}
        </div>
        {!isCurrentMonth && (
          <p className="text-caption-sm-regular text-tertiary">{t("activity_reports.past_month_note")}</p>
        )}
        {isTruncated && <p className="text-caption-sm-regular text-tertiary">{t("activity_reports.truncated")}</p>}
      </div>

      <div className="vertical-scrollbar scrollbar-sm flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {hasError && <p className="text-body-sm-regular text-secondary">{t("activity_reports.load_failed")}</p>}
        {!hasError && sections.length === 0 && (
          <p className="rounded-md border border-dashed border-subtle px-4 py-8 text-center text-body-sm-regular text-tertiary">
            {isLoading ? t("activity_reports.loading") : t("activity_reports.empty")}
          </p>
        )}
        {sections.map((section) => (
          <section
            key={section.project.id}
            // the left edge carries the project's color, as on the board
            style={{ borderLeftColor: section.tag.border }}
            className="rounded-lg border border-l-4 border-subtle bg-surface-1 p-4"
          >
            <header className="flex items-center gap-2 pb-3">
              <ProjectTag tag={section.tag} />
              <h2 className="text-body-md-semibold text-primary">{section.project.name}</h2>
            </header>
            {section.completed.length > 0 && (
              <div className="pb-3">
                <h3 className="flex items-center gap-2 pb-1 text-caption-md-medium text-secondary">
                  {t("activity_reports.completed")}
                  <span
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption-sm-semibold"
                    style={{
                      backgroundColor: GROUP_COLORS.completed.color,
                      color: GROUP_COLORS.completed.onColor,
                    }}
                  >
                    {section.completed.length}
                  </span>
                </h3>
                {renderRows(section.completed, true)}
              </div>
            )}
            {section.inProgress.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 pb-1 text-caption-md-medium text-secondary">
                  {t("activity_reports.in_progress")}
                  <span
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption-sm-semibold"
                    style={{
                      backgroundColor: GROUP_COLORS.started.color,
                      color: GROUP_COLORS.started.onColor,
                    }}
                  >
                    {section.inProgress.length}
                  </span>
                </h3>
                {renderRows(section.inProgress, false)}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
});
