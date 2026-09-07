import { Component, TemplateRef, contentChild, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { TranslatePipe } from '@cinema/i18n';
import { PageState } from './feedback';
export interface TableColumn {
  field: string;
  label: string;
  sortable?: boolean;
}
export interface TablePage {
  page: number;
  pageSize: number;
}
@Component({
  selector: 'cinema-table',
  imports: [TableModule, NgTemplateOutlet, TranslatePipe, PageState],
  template: `@if (error()) {
      <cinema-state [error]="error()" (retry)="retry.emit()" />
    } @else {
      <p-table
        [value]="rows()"
        [loading]="loading()"
        [dataKey]="dataKey()"
        [lazy]="true"
        [paginator]="paginated()"
        [rows]="pageSize()"
        [first]="(page() - 1) * pageSize()"
        [totalRecords]="total()"
        (onPage)="pageChanged.emit({ page: $event.first / $event.rows + 1, pageSize: $event.rows })"
        (onLazyLoad)="sortChanged.emit($event)"
        [selection]="selection()"
        (selectionChange)="selectionChanged.emit($event)"
        [rowHover]="true"
      >
        <ng-template #header>
          @if (columnDefinitions().length) {
            <tr>
              @if (selectable()) {
                <th><p-tableHeaderCheckbox /></th>
              }
              @for (column of columnDefinitions(); track column.field) {
                <th [pSortableColumn]="column.field" [pSortableColumnDisabled]="!column.sortable">
                  {{ column.label }}
                  @if (column.sortable) {
                    <p-sortIcon [field]="column.field" />
                  }
                </th>
              }
            </tr>
          } @else {
            <ng-container *ngTemplateOutlet="this.header() || null" />
          }
        </ng-template>
        <ng-template #body let-row let-index="rowIndex">
          @if (columnDefinitions().length) {
            <tr>
              @if (selectable()) {
                <td><p-tableCheckbox [value]="row" /></td>
              }
              @for (column of columnDefinitions(); track column.field) {
                <td>
                  @if (cell()) {
                    <ng-container
                      *ngTemplateOutlet="
                        cell() || null;
                        context: { $implicit: row, column: column, index: index }
                      "
                    />
                  } @else {
                    {{ field(row, column.field) }}
                  }
                </td>
              }
            </tr>
          } @else {
            <ng-container
              *ngTemplateOutlet="this.body() || null; context: { $implicit: row, index: index }"
            />
          }
        </ng-template>
        <ng-template #emptymessage>
          @if (empty()) {
            <ng-container *ngTemplateOutlet="empty() || null" />
          } @else {
            <tr>
              <td [attr.colspan]="columnDefinitions().length || columns()">
                {{ 'common.empty' | t }}
              </td>
            </tr>
          }
        </ng-template>
      </p-table>
    }`,
})
export class CinemaTable<T> {
  rows = input<T[]>([]);
  loading = input(false);
  error = input('');
  retry = output<void>();
  dataKey = input('id');
  columns = input(1);
  columnDefinitions = input<TableColumn[]>([]);
  selectable = input(false);
  selection = input<T[]>([]);
  selectionChanged = output<T[]>();
  paginated = input(false);
  total = input(0);
  page = input(1);
  pageSize = input(20);
  pageChanged = output<TablePage>();
  sortChanged = output<TableLazyLoadEvent>();
  header = contentChild<TemplateRef<unknown>>('header');
  body = contentChild<TemplateRef<{ $implicit: T; index: number }>>('body');
  cell = contentChild<TemplateRef<{ $implicit: T; column: TableColumn; index: number }>>('cell');
  empty = contentChild<TemplateRef<unknown>>('empty');
  field(row: T, field: string): unknown {
    return (row as Record<string, unknown>)[field];
  }
}
@Component({
  selector: 'cinema-pager',
  imports: [PaginatorModule],
  template: `<div [attr.inert]="busy() ? '' : null">
    <p-paginator
      [first]="(page() - 1) * size()"
      [rows]="size()"
      [totalRecords]="total()"
      (onPageChange)="changePage($event.page ?? 0)"
      [showCurrentPageReport]="true"
      currentPageReportTemplate="{first}–{last} / {totalRecords}"
    />
  </div>`,
})
export class Pager {
  total = input(0);
  page = input(1);
  size = input(20);
  busy = input(false);
  changed = output<number>();
  changePage(zeroBased: number) {
    if (!this.busy()) this.changed.emit(zeroBased + 1);
  }
}
