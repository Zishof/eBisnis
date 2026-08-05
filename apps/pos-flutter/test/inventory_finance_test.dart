import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parser keuangan mempertahankan akun jurnal periode dan laporan', () {
    final workspace = InventoryFinanceData.fromApi({
      'accounts': [
        {
          'id': 'a1',
          'code': '101',
          'name': 'Kas',
          'account_type': 'ASSET',
          'normal_balance': 'DEBIT',
          'allow_posting': true,
        }
      ],
      'periods': [
        {
          'id': 'p1',
          'code': '2026-08',
          'name': 'Agustus 2026',
          'start_date': '2026-08-01',
          'end_date': '2026-08-31',
          'status': 'OPEN',
        }
      ],
      'journals': [
        {
          'id': 'j1',
          'journal_number': 'JRN-001',
          'journal_date': '2026-08-06',
          'description': 'Setoran kas',
          'status': 'POSTED',
          'total_debit': '250000',
          'total_credit': '250000',
        }
      ],
      'closeRuns': [
        {
          'run_number': 'PER-001',
          'period_code': '2026-07',
          'status': 'CLOSED',
          'started_at': '2026-08-01',
        }
      ],
    });
    final report = InventoryFinancialReport.fromApi({
      'reportCode': 'profit-loss',
      'title': 'Laporan Laba Rugi Akuntansi',
      'asOfDate': '2026-08-31',
      'totals': {'balance': '750000'},
      'rows': [
        {'code': '400', 'name': 'Pendapatan', 'balance': '1000000'}
      ],
    });

    expect(workspace.accounts.single.category, 'ASSET');
    expect(workspace.journals.single.debit, workspace.journals.single.credit);
    expect(workspace.periods.single.status, 'OPEN');
    expect(workspace.closeRuns.single.status, 'CLOSED');
    expect(report.totalKey, 'balance');
    expect(report.total, 750000);
  });
}
