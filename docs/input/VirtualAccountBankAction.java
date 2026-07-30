package ais.action.master;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Serializable;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Map;

import org.hibernate.Criteria;
import org.hibernate.FlushMode;
import org.hibernate.criterion.Criterion;
import org.hibernate.Session;
import org.hibernate.Transaction;
import org.hibernate.criterion.MatchMode;
import org.hibernate.criterion.Order;
import org.hibernate.criterion.Projections;
import org.hibernate.criterion.Restrictions;
import org.json.JSONArray;
import org.json.JSONObject;
import org.zkoss.poi.xssf.usermodel.XSSFRow;
import org.zkoss.poi.xssf.usermodel.XSSFSheet;
import org.zkoss.poi.xssf.usermodel.XSSFWorkbook;
import org.zkoss.zk.ui.Component;
import org.zkoss.zk.ui.Sessions;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.sys.ExecutionsCtrl;
import org.zkoss.zk.ui.util.GenericAutowireComposer;
import org.zkoss.zul.A;
import org.zkoss.zul.Checkbox;
import org.zkoss.zul.Combobox;
import org.zkoss.zul.Filedownload;
import org.zkoss.zul.Hbox;
import org.zkoss.zul.Html;
import org.zkoss.zul.Label;
import org.zkoss.zul.ListModel;
import org.zkoss.zul.Messagebox;
import ais.ui.util.MyMessageboxConfig;
import org.zkoss.zul.Paging;
import org.zkoss.zul.Row;
import org.zkoss.zul.SimpleListModel;
import org.zkoss.zul.Textbox;
import org.zkoss.zul.Vbox;

import ais.action.master.helper.RevisiHelper;
import ais.action.master.helper.RevisiVirtualAccountBankHelper;
import ais.action.master.helper.util.PerguruanTinggiUtil;
import ais.action.master.helper.virtualaccount.DownloadTagihanMahasiswaBankBtn;
import ais.action.master.sekolah.util.SekolahUtil;
import ais.action.servlet.Bankaltimtara;
import ais.action.servlet.Esmartlink;
import ais.action.servlet.Flip;
import ais.action.servlet.Maja;
import ais.action.servlet.Mandiri;
import ais.common.BJBUtil;
import ais.common.BSIMajaUtil;
import ais.common.Common;
import ais.common.ConstantValues;
import ais.database.hibernate.HibernateUtil;
import ais.database.model.BankHost;
import ais.database.model.CicilanPembayaran;
import ais.database.model.Fakultas;
import ais.database.model.Jurusan;
import ais.database.model.Konfigurasi;
import ais.database.model.PerguruanTinggi;
import ais.database.model.Tbmuser;
import ais.database.model.Va;
import ais.database.model.VirtualAccountBank;
import ais.database.model.sekolah.AkunPembayaranSiswa;
import ais.database.model.sekolah.Sekolah;
import ais.database.model.sekolah.Yayasan;
import ais.ui.util.DataCriteria;
import ais.ui.util.MyCheckboxConfig;
import ais.ui.util.MyColumnConfig;
import ais.ui.util.MyDatebox;
import ais.ui.util.MyGrid;
import ais.ui.util.MyLabelKecil;
import ais.ui.util.MyLabelKecilSekali;
import ais.ui.util.MyToolbarbuttonConfig;
import ais.ui.util.WaktuUtil;
import ais.ui.util.VirtualAccountDashboardUtil;

public class VirtualAccountBankAction extends GenericAutowireComposer implements DataCriteria {

	/**
	 * 
	 */
	private static final long serialVersionUID = -5779730267402400328L;
	private Paging paging;
	private MyGrid grid;

	private Textbox mahasiswa;
	private Textbox kode;
	private Textbox keterangan;
	private Textbox bank;
	private Textbox jenis;
	private MyDatebox start;
	private MyDatebox end;
	private MyToolbarbuttonConfig find;
	private Checkbox searchTelahMembayar;
	private Textbox searchkode;
	private Checkbox searchBelumMembayar;
	private Checkbox searchKendala;
	private Checkbox searchBelumKadaluarsa;
	private Checkbox searchDariTanggalBayar;
	private Tbmuser tbmuser;

	private Row hbFakultasLabel;
	private Row hbYayasan;
	private boolean pt = false;
	private boolean ya = false;

	private Combobox searchfakultas;
	private Combobox searchjurusan;
	private Combobox searchyayasan;
	private Combobox searchsekolah;

	private MyColumnConfig biayaAdminCol;
	private MyColumnConfig topupCol;

	private BankHost bankHostDefault = null;
	/** Batas jumlah baris diproses per klik "Cek Ulang Massal", agar satu request tidak timeout. */
	private static final int MAKS_CEK_ULANG_MASSAL_PER_KLIK = 300;
	private Html dashboardHtml;
	private Html progressHtml;
	private boolean sedangMemuatData = false;
	private boolean ulangiLoadSetelahSelesai = false;

	@Override
	public org.zkoss.zk.ui.metainfo.ComponentInfo doBeforeCompose(org.zkoss.zk.ui.Page page,
			org.zkoss.zk.ui.Component parent, org.zkoss.zk.ui.metainfo.ComponentInfo compInfo) {
		Common.doCheckSecurity();
		return super.doBeforeCompose(page, parent, compInfo);
	}

	private String selectedBank = null;

	private void refreshSetelahCekPembayaran() {
		Common.createDefaultTimer(new EventListener() {
			@Override
			public void onEvent(Event arg0) throws Exception {
				onSearchDefault(null);
			}
		});
	}

	private MyToolbarbuttonConfig buatTombolCekUlang(String label) {
		MyToolbarbuttonConfig button = new MyToolbarbuttonConfig(label, "/img/svg/check2-circle.svg");
		button.setTooltiptext("Cek ulang status pembayaran dari gateway bank, lalu muat ulang data.");
		button.setOrient("vertical");
		return button;
	}

	private void tampilkanHasilCekPembayaran(String status, Object detail, String icon) {
		StringBuilder pesan = new StringBuilder();
		pesan.append(status == null || status.trim().length() == 0 ? "Cek pembayaran selesai." : status.trim());
		pesan.append("\n\nData akan dimuat ulang agar status terbaru langsung terlihat.");
		if (Common.getApakahAdmin() && detail != null) {
			pesan.append("\n\nDetail gateway:\n").append(detail);
		}
		try {
			MyMessageboxConfig.show(pesan.toString(), "Cek Pembayaran Ulang", MyMessageboxConfig.OK, icon);
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
	}

	private void tampilkanErrorCekPembayaran(Exception e) {
		Common.tampilErrorJikaAdmin(e);
		try {
			// Rincian teknis SEDETAIL MUNGKIN (nama kelas exception + pesan, ditelusuri
			// sampai akar rantai cause — mis. SocketTimeoutException di balik
			// curl/HTTP call ke gateway bank) langsung ke alert, bukan cuma
			// e.getMessage() yang sering null/tidak informatif (NPE, dsb).
			String detail = ais.common.InfoTeknisPembayaran.detailDariException(e);
			MyMessageboxConfig.showFormat(
					"Mohon maaf, proses pemeriksaan ulang pembayaran belum berhasil diproses. Rincian: {V1}. Langkah yang dapat dilakukan: (1) periksa kembali koneksi jaringan; (2) ulangi proses beberapa saat lagi; (3) apabila masih berlanjut, mohon hubungi Administrator sistem.",
					"Cek Pembayaran Ulang", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION,
					(detail.isEmpty() ? "Silakan coba kembali atau hubungi Administrator sistem." : detail));
		} catch (Exception ignored) { ais.common.ErrorAuditUtil.record(ignored, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:181");
		}
	}

	/**
	 * Cek ulang SATU {@link VirtualAccountBank} untuk mode MASSAL (dipanggil tombol "Cek Ulang
	 * Massal"): replikasi persis logika inti yang dipakai tombol "Cek Ulang" PER-BARIS di
	 * {@code VirtualAccountBankRenderer.render(...)} (Esmartlink/Maja/Flip/BJB/Bank BTN/Mandiri/
	 * Bankaltimtara VA-QRIS/bankaltimtara baru) — TANPA dialog konfirmasi per-baris dan TANPA
	 * popup hasil per-baris (kedua hal itu tidak relevan/tidak diinginkan saat memproses banyak
	 * baris sekaligus; hasil dikumpulkan {@link ais.common.LaporanUpload} oleh pemanggil).
	 *
	 * <p>Sengaja TIDAK me-refactor/menghapus kode per-baris yang sudah ada (biar tombol Cek Ulang
	 * per-baris yang sudah terverifikasi bekerja tidak tersentuh sama sekali) — method ini murni
	 * DUPLIKAT logika intinya (memanggil helper statis bank yang SAMA PERSIS: {@link Bankaltimtara},
	 * {@link BSIMajaUtil}, {@link Flip}, {@link BJBUtil}, {@link Mandiri}, {@link Esmartlink},
	 * {@link DownloadTagihanMahasiswaBankBtn}, {@code ais.action.servlet.Va}), agar "reuse" di
	 * level bank-gateway sesungguhnya, tanpa risiko mengubah perilaku tombol yang sudah berjalan.</p>
	 *
	 * @return ringkasan hasil singkat (dipakai sebagai "keterangan" baris berhasil di laporan)
	 * @throws Exception bila pemeriksaan gagal ATAU bila bank pada baris ini tidak punya mekanisme
	 *                    Cek Ulang yang cocok (dilempar apa adanya agar
	 *                    {@code LaporanUpload.catatGagalDetail} mencatat detail forensik lengkap)
	 */
	private String cekUlangSatuVaMasal(VirtualAccountBank virtualAccountBankReadOnly) throws Exception {
		String bankVirtualAccount = virtualAccountBankReadOnly.getBank() == null ? ""
				: virtualAccountBankReadOnly.getBank();

		if (bankVirtualAccount.equalsIgnoreCase("Esmartlink") && virtualAccountBankReadOnly.getResponse() != null
				&& !virtualAccountBankReadOnly.getResponse().isEmpty()) {
			JSONObject req = new JSONObject(virtualAccountBankReadOnly.getResponse());
			JSONObject dataReq = req.getJSONObject("data");
			String transaction_id = dataReq.get("transaction_id") + "";

			String linkPost = Common.getKonfigurasi("url_status_va_smartlink",
					"https://payment-service.pakar-digital.com/api/payment/inquiry-order/").getNilai().trim()
					+ transaction_id;

			String username_va_e_smartlink = Common
					.getKonfigurasi("username_va_e_smartlink", "<REDACTED_USERNAME>").getNilai().trim();
			String password_va_e_smartlink = Common.getKonfigurasi("password_va_e_smartlink", "<REDACTED_PASSWORD>")
					.getNilai().trim();

			if (virtualAccountBankReadOnly.getSiswa() != null) {
				username_va_e_smartlink = virtualAccountBankReadOnly.getSiswa().getSekolah().getUsernameEsmartlink();
				password_va_e_smartlink = virtualAccountBankReadOnly.getSiswa().getSekolah().getPasswordEsmartlink();
			} else if (virtualAccountBankReadOnly.getCalonSiswa() != null) {
				username_va_e_smartlink = virtualAccountBankReadOnly.getCalonSiswa().getSekolah()
						.getUsernameEsmartlink();
				password_va_e_smartlink = virtualAccountBankReadOnly.getCalonSiswa().getSekolah()
						.getPasswordEsmartlink();
			}
			if (virtualAccountBankReadOnly.getKanalPembayaran() != null) {
				username_va_e_smartlink = virtualAccountBankReadOnly.getKanalPembayaran().getUsernameEsmartlink();
				password_va_e_smartlink = virtualAccountBankReadOnly.getKanalPembayaran().getPasswordEsmartlink();
			}

			String hasil = VirtualAccountBank.curlSmartlinkGet(linkPost, username_va_e_smartlink,
					password_va_e_smartlink);
			JSONObject jsonObject2 = new JSONObject(hasil);
			String status = jsonObject2.isNull("data") || jsonObject2.getJSONObject("data").isNull("status") ? "ERROR"
					: jsonObject2.getJSONObject("data").get("status") + "";
			boolean masuk = status.trim().equalsIgnoreCase("success");
			if (masuk) {
				Esmartlink.doProses(hasil, null,
						virtualAccountBankReadOnly.getBankHost() == null ? bankHostDefault
								: virtualAccountBankReadOnly.getBankHost(),
						virtualAccountBankReadOnly.getBank(), true);
				return "Esmartlink: pembayaran ditemukan & diproses";
			}
			return "Esmartlink: belum ditemukan pembayaran (status gateway=" + status + ")";
		}

		if (bankVirtualAccount.equalsIgnoreCase("Maja")) {
			String CLIENT_TOKEN = null;
			try {
				CLIENT_TOKEN = BSIMajaUtil.sendRequestToken(null, virtualAccountBankReadOnly.getKanalPembayaran());
			} catch (Exception e1) {
				ais.common.ErrorAuditUtil.record(e1,
						"auto-audit src/ais/action/master/VirtualAccountBankAction.java:cekUlangSatuVaMasal-Maja-token");
			}
			Session session = HibernateUtil.currentSession();
			VirtualAccountBank virtualAccountBank = (VirtualAccountBank) session
					.createCriteria(VirtualAccountBank.class)
					.add(Restrictions.idEq(virtualAccountBankReadOnly.getId())).uniqueResult();

			JSONObject bsi = BSIMajaUtil.inqiery(virtualAccountBank, CLIENT_TOKEN, bankHostDefault);
			JSONObject hasil = bsi.isNull("data") ? bsi : bsi.getJSONObject("data");
			if (hasil != null && !hasil.isNull("va")) {
				return hasil.getBoolean("paid") ? "Maja/BSI: TELAH DIBAYAR" : "Maja/BSI: belum dibayar";
			}
			throw new Exception("Maja/BSI: pemeriksaan gagal — respons gateway tidak memuat field \"va\" ("
					+ bsi + ")");
		}

		if (bankVirtualAccount.equalsIgnoreCase("Flip") && virtualAccountBankReadOnly.getNotif() != null
				&& !virtualAccountBankReadOnly.getNotif().trim().isEmpty()) {
			Flip.doProses(virtualAccountBankReadOnly.getNotif(), null,
					virtualAccountBankReadOnly.getBankHost() == null ? bankHostDefault
							: virtualAccountBankReadOnly.getBankHost(),
					virtualAccountBankReadOnly.getBank(), true);
			return "Flip: notifikasi tersimpan diproses ulang";
		}

		if (bankVirtualAccount.equalsIgnoreCase("BJB")) {
			String postData = "";
			String cin = Common.getKonfigurasi("bjb_langsung_cin", "530").getNilai();
			JSONObject hasil = BJBUtil.inquiryBillingBJB(postData, cin, virtualAccountBankReadOnly.getKode(),
					bankHostDefault, true);
			if (hasil != null && !hasil.isNull("transactions")) {
				return "BJB: transaksi ditemukan";
			} else if (hasil != null) {
				return "BJB: belum dibayar";
			}
			throw new Exception("BJB: pemeriksaan pembayaran tidak berhasil dilakukan (respons gateway kosong)");
		}

		if (bankVirtualAccount.equalsIgnoreCase("Bank BTN")) {
			JSONObject hasil;
			if ((virtualAccountBankReadOnly.getPembayaran() != null || virtualAccountBankReadOnly.getKegiatan() != null)
					&& virtualAccountBankReadOnly.getNotif() != null
					&& !virtualAccountBankReadOnly.getNotif().isEmpty()) {
				String body = ais.action.servlet.Va.doProses(virtualAccountBankReadOnly.getNotif(), null,
						virtualAccountBankReadOnly.getBankHost(), true);
				hasil = new JSONObject(body);
			} else {
				hasil = DownloadTagihanMahasiswaBankBtn.inquiryBillingBTN(virtualAccountBankReadOnly.getKode(),
						virtualAccountBankReadOnly.getBankHost(), virtualAccountBankReadOnly);
			}
			if (hasil != null && !hasil.isNull("terbayar")) {
				Double nominalP;
				try {
					nominalP = Double.parseDouble(hasil.get("terbayar") + "");
				} catch (Exception e) {
					nominalP = 0.0;
				}
				return nominalP > 0.1 ? "BTN: pembayaran ditemukan" : "BTN: belum dibayar";
			}
			throw new Exception("BTN: pemeriksaan pembayaran gagal dilakukan (respons gateway: " + hasil + ")");
		}

		if (virtualAccountBankReadOnly.getNotif() != null
				&& virtualAccountBankReadOnly.getNotif().contains("transmissionDateTime")) {
			Mandiri.doProses(virtualAccountBankReadOnly.getNotif(), null,
					virtualAccountBankReadOnly.getBankHost() == null ? bankHostDefault
							: virtualAccountBankReadOnly.getBankHost(),
					virtualAccountBankReadOnly.getBank(), true);
			return "Mandiri: notifikasi tersimpan diproses ulang";
		}

		if (bankVirtualAccount.equalsIgnoreCase("Bank Bankaltimtara") || bankVirtualAccount.equalsIgnoreCase("BMS")) {
			JSONObject jsonObject2 = virtualAccountBankReadOnly.getPakaiva()
					? Bankaltimtara.checkPakaiva(virtualAccountBankReadOnly)
					: Bankaltimtara.checkPakaiqris(virtualAccountBankReadOnly);
			return "Bankaltimtara: " + (jsonObject2 == null ? "tidak ada respons dari gateway" : jsonObject2.toString());
		}

		if (virtualAccountBankReadOnly.getMahasiswa() != null
				&& bankVirtualAccount.equalsIgnoreCase("bankaltimtara baru")) {
			String linkPost = Common
					.getKonfigurasi("url_status_va_bankaltimtara_baru", "http://<REDACTED_HOST>:8017/ubt/status_va")
					.getNilai().trim();
			String signatureKey = Common
					.getKonfigurasi("key_bankaltimtara_baru", "<REDACTED_API_KEY>")
					.getNilai().trim();
			String appId = Common.getKonfigurasi("app_id_bankaltimtara_baru", "<REDACTED_APP_ID>")
					.getNilai().trim();

			String npm = virtualAccountBankReadOnly.getBiodataCalonMahasiswa() != null
					? virtualAccountBankReadOnly.getBiodataCalonMahasiswa().getNoRegistrasi()
					: virtualAccountBankReadOnly.getMahasiswa().getNim();

			String payload = appId + ";status_va:" + npm;
			String signature = Common.buildHmacSignature(payload, signatureKey);

			JSONObject jsonObject = new JSONObject();
			jsonObject.put("npm", npm);

			String[] command = { "curl", "--location", "--request", "GET", linkPost, "--header",
					"Content-Type: application/json", "--header", "signature: " + signature, "--data",
					jsonObject.toString() };

			ProcessBuilder process = new ProcessBuilder(command);
			Process p = process.start();
			BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()));
			StringBuilder builder = new StringBuilder();
			String line;
			while ((line = reader.readLine()) != null) {
				builder.append(line);
				builder.append(System.getProperty("line.separator"));
			}
			String hasil = builder.toString();

			JSONObject jsonObject2 = new JSONObject(hasil);
			boolean sudahTerbayar = false;

			JSONArray data = jsonObject2.getJSONArray("data");
			for (int idx = 0; idx < data.length(); idx++) {
				try {
					JSONObject object = data.getJSONObject(idx);
					if (virtualAccountBankReadOnly.getSemester()
							.equals(Integer.parseInt((object.get("semester") + "").trim()))) {
						Double paid = Double.parseDouble((object.get("paid") + "").trim());
						if (paid.intValue() == virtualAccountBankReadOnly.getTotal().intValue()) {
							sudahTerbayar = true;
							Session sessionBayar = null;
							try {
								sessionBayar = HibernateUtil.currentNativeSession();
								VirtualAccountBank.bayarVa(virtualAccountBankReadOnly, WaktuUtil.getDate(), hasil,
										sessionBayar);
							} finally {
								Common.closeNativeSessionQuietly(sessionBayar);
							}
						}
					}
				} catch (Exception e) {
					ais.common.ErrorAuditUtil.record(e,
							"auto-audit src/ais/action/master/VirtualAccountBankAction.java:cekUlangSatuVaMasal-bankaltimtaraBaru-item");
				}
			}

			return sudahTerbayar ? "Bankaltimtara baru: pembayaran ditemukan & diproses"
					: "Bankaltimtara baru: belum ditemukan pembayaran";
		}

		throw new Exception("Tidak ada mekanisme \"Cek Ulang\" yang cocok untuk bank \"" + bankVirtualAccount
				+ "\" pada VA kode " + virtualAccountBankReadOnly.getKode()
				+ " (baris ini tidak menampilkan tombol Cek Ulang di grid, sehingga dilewati oleh Cek Ulang Massal juga)");
	}

	private Html buatStatusPembayaran(VirtualAccountBank virtualAccountBank) {
		boolean sudahBayar = virtualAccountBank != null && (virtualAccountBank.getKegiatan() != null
				|| virtualAccountBank.getPembayaran() != null || virtualAccountBank.getDeposit() != null);
		String bg = sudahBayar ? "#dcfce7" : "#fef9c3";
		String color = sudahBayar ? "#166534" : "#854d0e";
		String border = sudahBayar ? "#bbf7d0" : "#fde68a";
		String label = sudahBayar ? "Sudah dibayar" : "Belum dibayar";
		String detail = "";
		if (sudahBayar && virtualAccountBank.getWaktuBayar() != null) {
			detail = Common.dateFormat3.get().format(virtualAccountBank.getWaktuBayar());
		} else if (!sudahBayar && virtualAccountBank.getKadaluarsaWaktu() != null) {
			detail = "Kadaluarsa " + Common.dateFormat.get().format(virtualAccountBank.getKadaluarsaWaktu());
		}
		return new Html("<div style='display:inline-block;min-width:96px;background:" + bg + ";color:" + color
				+ ";border:1px solid " + border + ";border-radius:8px;padding:5px 8px;font-size:11px;font-weight:800;'>"
				+ escapeHtml(label)
				+ (detail.length() == 0 ? "" : "<div style='font-size:10px;font-weight:600;margin-top:2px;'>"
						+ escapeHtml(detail) + "</div>")
				+ "</div>");
	}

	private String escapeHtml(String value) {
		if (value == null) {
			return "";
		}
		return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
				.replace("'", "&#39;");
	}

	public void doAfterCompose(Component comp) throws Exception {
		// TODO Auto-generated method stub
		super.doAfterCompose(comp);
		Common.initLaguage();

		tbmuser = Common.getCurrentUser();

		if (tbmuser != null && tbmuser.getMahasiswa() != null) {
			mahasiswa.setValue(tbmuser.getMahasiswa().getNim());
			mahasiswa.setReadonly(true);
			mahasiswa.setDisabled(true);
		}

		if (execution.getParameter("b") != null && !execution.getParameter("b").trim().isEmpty()) {
			selectedBank = execution.getParameter("b").trim();
		}

		try {
			pt = Common.bolehKonfigurasi("apakah_aktifkan_modul_perguruan_tinggi");
			ya = Common.bolehKonfigurasi("apakah_aktifkan_modul_sekolah", Konfigurasi.TIDAK_AKTIF);

			Sekolah sekolah = SekolahUtil.getSekolah();
			if (sekolah != null && sekolah.getId() != null) {
				pt = false;
				ya = true;
			}

			if (searchfakultas != null && searchjurusan != null && hbFakultasLabel != null && hbYayasan != null
					&& searchyayasan != null && searchsekolah != null) {
				Common.initFakultasDanJurusanDanSemua(null, null, searchfakultas, searchjurusan);
				Common.initYayasanDanSekolahDanSemua(null, null, searchyayasan, searchsekolah, true, false);

				hbFakultasLabel.setVisible(pt && searchfakultas.getChildren().size() > 1);
				hbYayasan.setVisible(ya);
			}
		} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:249");
			// TODO: handle exception
		}

		biayaAdminCol.setVisible(Common.bolehKonfigurasi("tampilkan_biaya_admin_di_virtual_account"));

		topupCol.setVisible(Common.bolehKonfigurasi("tampilkan_topup_di_virtual_account"));

		String ipconf = Common.getKonfigurasi("ip_bank_pembayaran_online_default", "0.0.0.0").getNilai();
		@SuppressWarnings("unchecked")
		Map<Serializable, BankHost> banks = ConstantValues.ambilBerdasarClass(BankHost.class);
		for (BankHost bankHost : banks.values()) {
			if (bankHost != null && bankHost.getIp() != null && bankHost.getIp().equalsIgnoreCase(ipconf)) {
				bankHostDefault = bankHost;
				break;
			}
		}

		if (bankHostDefault == null) {
			BankHost h = (BankHost) HibernateUtil.currentSession().createCriteria(BankHost.class).setMaxResults(1)
					.addOrder(Order.desc("id")).add(Restrictions.eq("ip", ipconf)).uniqueResult();
			bankHostDefault = h;
		}

		if (start != null) start.setReadonly(true);
		if (end != null) end.setReadonly(true);

		Calendar calendar = ais.ui.util.WaktuUtil.getCalendar();
		calendar.set(Calendar.WEEK_OF_MONTH, calendar.get(Calendar.WEEK_OF_MONTH) - 1);
		if (start != null) start.setValue(calendar.getTime());
		calendar = ais.ui.util.WaktuUtil.getCalendar();
		calendar.set(Calendar.DATE, calendar.get(Calendar.DATE) + 1);
		if (end != null) end.setValue(calendar.getTime());

		Common.createDefaultTimer(new EventListener() {

			@Override
			public void onEvent(Event arg0) throws Exception {
				onSearchDefault(null);

			}
		});

		Common.initPaging(paging, new EventListener() {

			@Override
			public void onEvent(Event arg0) throws Exception {
				onSearchDefault(null);

			}
		});

		MyToolbarbuttonConfig cetakToolbarbutton = Common.cetakData(this, "kode",
				"mahasiswa.nim||biodataCalonMahasiswa.noRegistrasi||siswa.nomorInduk||calonSiswa.noRegistrasi",
				"mahasiswa.nama||biodataCalonMahasiswa.nama||siswa.nama||calonSiswa.nama",
				"mahasiswa.jurusan.nama||biodataCalonMahasiswa.prodiLulus.nama||biodataCalonMahasiswa.prodi1.nama||siswa.sekolah.nama||calonSiswa.sekolah.nama",
				"bank", "jenisKegiatan", "jadwalPembayaran||nama", "tahunAkademik", "semester", "total", "biayaAdmin",
				"topup", "amount", "kegiatan", "waktuBayar", "tanggal_dirubah", "oleh", "detailbiaya", "keterangan",
				"kadaluarsa", "notif", "kanalPembayaran", "kelas");
		Common.appendKeToolbar(cetakToolbarbutton, find, comp);

		MyToolbarbuttonConfig button = new MyToolbarbuttonConfig("History", "/img/jadwal.png");
		button.addEventListener("onClick", new EventListener() {

			@Override
			public void onEvent(Event event) throws Exception {
				RevisiVirtualAccountBankHelper revisiHelper = new RevisiVirtualAccountBankHelper(new EventListener() {

					@Override
					public void onEvent(Event arg0) throws Exception {
						Common.createDefaultTimer(new EventListener() {

							@Override
							public void onEvent(Event arg0) throws Exception {
								onSearchDefault(arg0);
							}
						});
					}
				});
				ExecutionsCtrl.getCurrentCtrl().getCurrentPage().getFirstRoot().appendChild(revisiHelper);
				revisiHelper.setVisible(true);
				revisiHelper.onModal();

			}

		});
		if (button != null) { button.setParent(find.getParent()); }

		button = new MyToolbarbuttonConfig("Muat Ulang Dasbor", "/img/svg/check2-circle.svg");
		if (button != null) { button.setTooltiptext("Muat ulang tabel dan ringkasan dasbor sesuai filter saat ini."); }
		button.addEventListener("onClick", new EventListener() {
			@Override
			public void onEvent(Event event) throws Exception {
				onSearchDefault(event);
			}
		});
		if (button != null) { button.setParent(find.getParent()); }

		button = new MyToolbarbuttonConfig("Fokus Belum Bayar", "/img/svg/check2-circle.svg");
		if (button != null) { button.setTooltiptext("Tampilkan VA yang belum dibayar dan masih perlu dicek atau ditindaklanjuti."); }
		button.addEventListener("onClick", new EventListener() {
			@Override
			public void onEvent(Event event) throws Exception {
				searchTelahMembayar.setChecked(false);
				searchBelumMembayar.setChecked(true);
				searchKendala.setChecked(false);
				onSearchDefault(event);
			}
		});
		if (button != null) { button.setParent(find.getParent()); }

		button = new MyToolbarbuttonConfig("Fokus Kendala", "/img/svg/warning-outline.svg");
		if (button != null) { button.setTooltiptext("Tampilkan VA yang ditandai kendala agar mudah dicek ulang."); }
		button.addEventListener("onClick", new EventListener() {
			@Override
			public void onEvent(Event event) throws Exception {
				searchTelahMembayar.setChecked(false);
				searchBelumMembayar.setChecked(false);
				searchKendala.setChecked(true);
				onSearchDefault(event);
			}
		});
		if (button != null) { button.setParent(find.getParent()); }

		if (Common.getApakahAdmin()) {
			button = new MyToolbarbuttonConfig("Lihat IP Outbound Server", "/img/svg/check2-circle.svg");
			button.setTooltiptext("Tampilkan IP publik/outbound server saat ini — kirimkan ke bank (mis. Bankaltimtara) "
					+ "bila \"Cek Ulang\" menolak dengan pesan semacam \"IP Partner is not registered\" agar bank "
					+ "mendaftarkan IP ini ke whitelist partner mereka.");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {
					try {
						String ip = ais.common.NetworkDiagnosticUtil.ambilIpPublikOutbound();
						MyMessageboxConfig.show(
								"IP publik/outbound server saat ini:\n\n" + ip
										+ "\n\nBila tombol \"Cek Ulang\" suatu bank menolak dengan pesan seperti "
										+ "\"IP Partner is not registered\", kirimkan IP di atas ke pihak bank yang "
										+ "bersangkutan (mis. Bankaltimtara) agar didaftarkan ke whitelist partner "
										+ "mereka. Ini bukan pengaturan yang bisa diubah dari sisi AIS — penolakan "
										+ "terjadi di sisi bank sebelum data kita sempat diproses.",
								"IP Outbound Server", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					} catch (Exception e) {
						MyMessageboxConfig.show(
								"Gagal memeriksa IP publik server:\n\n" + ais.common.LaporanUpload.detailTeknisException(e),
								"Kesalahan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
					}
				}
			});
			if (button != null) { button.setParent(find.getParent()); }
		}

		if (Common.getApakahAdmin()) {
			button = new MyToolbarbuttonConfig("Cek Ulang Massal", "/img/svg/check2-circle.svg");
			button.setTooltiptext("Jalankan \"Cek Ulang\" untuk SEMUA baris yang cocok dengan filter/pencarian saat ini "
					+ "(gunakan \"Fokus Belum Bayar\" dulu agar tidak memeriksa ulang yang sudah lunas). Berlaku untuk "
					+ "semua bank yang punya tombol Cek Ulang per-baris (Bankaltimtara, BMS, Maja/BSI, Flip, BJB, Bank BTN, "
					+ "Mandiri, Esmartlink, bankaltimtara baru). Hasil per-baris (berhasil/gagal beserta rinciannya) "
					+ "dikumpulkan dalam satu file laporan yang bisa diunduh.");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {

					MyMessageboxConfig.show(
							"Apakah Bapak/Ibu yakin ingin melakukan Cek Ulang MASSAL untuk seluruh data yang cocok dengan "
									+ "filter/pencarian saat ini? Proses ini memeriksa ulang status pembayaran satu per satu "
									+ "ke gateway masing-masing bank, dan bisa memakan waktu cukup lama bila datanya banyak. "
									+ "Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.",
							"Pertanyaan", MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION,
							new EventListener() {
								@Override
								public void onEvent(Event event) throws Exception {
									int i = Integer.parseInt(event.getData().toString());
									if (i != MyMessageboxConfig.OK) {
										return;
									}

									@SuppressWarnings("unchecked")
									final List<Long> ids = initCriteria(false)
											.setProjection(Projections.property("id"))
											.setMaxResults(MAKS_CEK_ULANG_MASSAL_PER_KLIK).list();

									final ais.common.LaporanUpload laporan = new ais.common.LaporanUpload(
											"Cek Ulang Massal Virtual Account");
									if (ids.size() >= MAKS_CEK_ULANG_MASSAL_PER_KLIK) {
										laporan.tambahCatatan("Jumlah data yang cocok filter mencapai/melebihi batas "
												+ MAKS_CEK_ULANG_MASSAL_PER_KLIK + " per klik — hanya "
												+ MAKS_CEK_ULANG_MASSAL_PER_KLIK
												+ " baris PERTAMA (sesuai urutan grid) yang diproses kali ini. "
												+ "Silakan klik \"Cek Ulang Massal\" lagi untuk memproses sisanya.");
									}

									final Label label = Common.displayLoadBar(new EventListener() {
										@Override
										public void onEvent(Event arg0) throws Exception {
											laporan.selesaikan(new EventListener() {
												@Override
												public void onEvent(Event event) throws Exception {
													onSearchDefault(null);
												}
											});
										}
									});

									new Thread(new Runnable() {
										@Override
										public void run() {
											try {
												int nomorBaris = 0;
												int total = ids.size();
												for (Long id : ids) {
													String kunci = "ID:" + id;
													try {
														Session session = HibernateUtil.currentNativeSession();
														VirtualAccountBank va = (VirtualAccountBank) session
																.get(VirtualAccountBank.class, id);
														if (va == null) {
															laporan.catatDilewati(nomorBaris, kunci,
																	"Data tidak ditemukan (kemungkinan sudah dihapus)");
														} else {
															kunci = String.valueOf(va);
															label.setValue("Cek Ulang massal (" + (nomorBaris + 1) + "/"
																	+ total + "): " + va);
															String hasil = cekUlangSatuVaMasal(va);
															laporan.catatBerhasil(nomorBaris, kunci, hasil);
														}
													} catch (Exception e) {
														Common.tampilErrorJikaAdmin(e);
														laporan.catatGagalDetail(nomorBaris, kunci, e);
													} finally {
														HibernateUtil.closeSession();
													}
													nomorBaris++;
												}
											} catch (Exception e) {
												Common.tampilErrorJikaAdmin(e);
												laporan.tambahCatatan(
														"Proses Cek Ulang Massal terhenti total (di luar per-baris): "
																+ ais.common.LaporanUpload.detailTeknisException(e));
											} finally {
												label.setValue("");
												ais.database.hibernate.HibernateUtil.closeSession();
											}
										}
									}).start();
								}
							});
				}
			});
			if (button != null) { button.setParent(find.getParent()); }
		}

		if (Common.bolehKonfigurasi("aktifkan_va_e_smartlink", Konfigurasi.TIDAK_AKTIF)) {
			button = new MyToolbarbuttonConfig("Reconsile", "/img/svg/check2-circle.svg");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {

					MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan rekonsiliasi (reconcile) seluruh data pembayaran? Proses ini akan memeriksa dan menyelaraskan seluruh transaksi pembayaran dengan data pada bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
							MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

								@SuppressWarnings("unchecked")
								@Override
								public void onEvent(Event event) throws Exception {
									int i = Integer.parseInt(event.getData().toString());
									if (i == MyMessageboxConfig.OK) {

										final String filename = Sessions.getCurrent().getWebApp()
												.getRealPath("/tmp/reconsile_smartlink_"
														+ URLEncoder.encode(Common.datetimeFormat2s.get()
																.format(ais.ui.util.WaktuUtil.getDate()), "UTF-8")
														+ ".xlsx");

										final File file = new File(filename);
										file.getParentFile().mkdirs();
										file.createNewFile();

										final Label label = Common.displayLoadBar(new EventListener() {

											@Override
											public void onEvent(Event arg0) throws Exception {

												Filedownload.save(new FileInputStream(file),
														"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
														file.getName());

												onSearchDefault(null);
											}
										});

										new Thread(new Runnable() {

											@Override
											public void run() {

												XSSFWorkbook workbook = new XSSFWorkbook();
												XSSFSheet sheet = workbook
														.createSheet(Common.getBahasaConfig("CETAK DATA"));
												sheet.setDefaultColumnWidth(20);
												XSSFRow rowhead = sheet.createRow((short) 0);
												rowhead.createCell(0).setCellValue("VA");
												rowhead.createCell(1).setCellValue("Uraian");
												rowhead.createCell(2).setCellValue("Hasil");

												int rowIndex = 0;
												List<VirtualAccountBank> virtualAccountBanks = initCriteria(true)
														.list();

												int size = virtualAccountBanks.size();

												for (VirtualAccountBank virtualAccountBank : virtualAccountBanks) {
													try {
														rowIndex++;
														String uraian = virtualAccountBank.getMahasiswa() == null
																? (virtualAccountBank.getBiodataCalonMahasiswa() == null
																		? ""
																		: virtualAccountBank.getBiodataCalonMahasiswa()
																				.toString())
																: virtualAccountBank.getMahasiswa().toString();
														double h = (rowIndex * 100.0) / size;
														label.setValue("Proses " + uraian + " ("
																+ Common.numberFormat.get().format(h) + "%)");
														if (virtualAccountBank.getResponse() != null
																&& !virtualAccountBank.getResponse().isEmpty()) {
															JSONObject req = new JSONObject(
																	virtualAccountBank.getResponse());
															JSONObject dataReq = req.getJSONObject("data");
															String transaction_id = dataReq.get("transaction_id") + "";

															String linkPost = Common.getKonfigurasi(
																	"url_status_va_smartlink",
																	"https://payment-service.pakar-digital.com/api/payment/inquiry-order/")
																	.getNilai().trim() + transaction_id;

															String username_va_e_smartlink = Common
																	.getKonfigurasi("username_va_e_smartlink",
																			"<REDACTED_USERNAME>")
																	.getNilai().trim();
															String password_va_e_smartlink = Common
																	.getKonfigurasi("password_va_e_smartlink",
																			"<REDACTED_PASSWORD>")
																	.getNilai().trim();

															if (virtualAccountBank.getSiswa() != null) {
																username_va_e_smartlink = virtualAccountBank.getSiswa()
																		.getSekolah().getUsernameEsmartlink();
																password_va_e_smartlink = virtualAccountBank.getSiswa()
																		.getSekolah().getPasswordEsmartlink();

															} else if (virtualAccountBank.getCalonSiswa() != null) {
																username_va_e_smartlink = virtualAccountBank
																		.getCalonSiswa().getSekolah()
																		.getUsernameEsmartlink();
																password_va_e_smartlink = virtualAccountBank
																		.getCalonSiswa().getSekolah()
																		.getPasswordEsmartlink();

															}

															if (virtualAccountBank != null && virtualAccountBank
																	.getKanalPembayaran() != null) {
																username_va_e_smartlink = virtualAccountBank
																		.getKanalPembayaran().getUsernameEsmartlink();
																password_va_e_smartlink = virtualAccountBank
																		.getKanalPembayaran().getPasswordEsmartlink();
															}

															JSONObject jsonObject2 = null;

															try {

																String hasil = VirtualAccountBank.curlSmartlinkGet(
																		linkPost, username_va_e_smartlink,
																		password_va_e_smartlink);

//																System.out.println("hasil -> " + hasil);
																jsonObject2 = new JSONObject(hasil);
																String status = jsonObject2.isNull("data")
																		|| jsonObject2.getJSONObject("data")
																				.isNull("status")
																						? "ERROR"
																						: jsonObject2
																								.getJSONObject("data")
																								.get("status") + "";
																boolean masuk = status.trim()
																		.equalsIgnoreCase("success");

																if (masuk) {

																	Esmartlink.doProses(hasil, null,
																			virtualAccountBank.getBankHost() == null
																					? bankHostDefault
																					: virtualAccountBank.getBankHost(),
																			virtualAccountBank.getBank(), true);
																}
															} catch (Exception e) {
																ais.common.Common.tampilErrorJikaAdmin(e);
															}

															uraian += " ";

															uraian += virtualAccountBank.getJenisKegiatan() == null ? ""
																	: virtualAccountBank.getJenisKegiatan()
																			.getNamaKegiatan();

															uraian += " ";

															uraian += virtualAccountBank.getJadwalPembayaran() == null
																	? ""
																	: Common.dateFormat1.get().format(virtualAccountBank
																			.getJadwalPembayaran().getStartDate())
																			+ " s.d "
																			+ Common.dateFormat1.get()
																					.format(virtualAccountBank
																							.getJadwalPembayaran()
																							.getEndDate());

															uraian += " ";

															uraian += (virtualAccountBank.getKegiatan() == null
																	&& virtualAccountBank.getPembayaran() == null)
																			? "Belum dibayar"
																			: (virtualAccountBank.getKegiatan() != null
																					? "Telah dibayar "
																							+ virtualAccountBank
																									.getKegiatan()
																					: "Telah Bayar "
																							+ virtualAccountBank
																									.getPembayaran());

															XSSFRow row = sheet.createRow(rowIndex);
															row.createCell(0)
																	.setCellValue(virtualAccountBank.getKode());
															row.createCell(1).setCellValue(uraian);
															row.createCell(2)
																	.setCellValue(jsonObject2 == null ? "Tidak ada info"
																			: jsonObject2.toString());
														}
													} catch (Exception e) {
														Common.tampilErrorJikaAdmin(e);

													}
												}

												try {
													FileOutputStream fileOut = new FileOutputStream(filename);
													workbook.write(fileOut);
													fileOut.close();
												} catch (IOException e) {
													// TODO Auto-generated catch block
													Common.tampilErrorJikaAdmin(e);
												}

												label.setValue("");
												virtualAccountBanks = null;
											}
										}).start();

									}

								}
							});

				}

			});
			button.setParent(find.getParent());
		}

		if (Common.bolehKonfigurasi("aktifkan_va_bankaltimtara_baru", Konfigurasi.TIDAK_AKTIF)) {
			button = new MyToolbarbuttonConfig("Reconsile", "/img/svg/check2-circle.svg");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {

					MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan rekonsiliasi (reconcile) seluruh data pembayaran? Proses ini akan memeriksa dan menyelaraskan seluruh transaksi pembayaran dengan data pada bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
							MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

								@SuppressWarnings("unchecked")
								@Override
								public void onEvent(Event event) throws Exception {
									int i = Integer.parseInt(event.getData().toString());
									if (i == MyMessageboxConfig.OK) {

										final String filename = Sessions.getCurrent().getWebApp()
												.getRealPath("/tmp/reconsile_bankaltimtara_"
														+ URLEncoder.encode(Common.datetimeFormat2s.get()
																.format(ais.ui.util.WaktuUtil.getDate()), "UTF-8")
														+ ".xlsx");

										final File file = new File(filename);
										file.getParentFile().mkdirs();
										file.createNewFile();

										final Label label = Common.displayLoadBar(new EventListener() {

											@Override
											public void onEvent(Event arg0) throws Exception {

												Filedownload.save(new FileInputStream(file),
														"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
														file.getName());

												onSearchDefault(null);
											}
										});

										new Thread(new Runnable() {

											@Override
											public void run() {

												XSSFWorkbook workbook = new XSSFWorkbook();
												XSSFSheet sheet = workbook
														.createSheet(Common.getBahasaConfig("CETAK DATA"));
												sheet.setDefaultColumnWidth(20);
												XSSFRow rowhead = sheet.createRow((short) 0);
												rowhead.createCell(0).setCellValue("VA");
												rowhead.createCell(1).setCellValue("Uraian");
												rowhead.createCell(2).setCellValue("Hasil");

												int rowIndex = 0;
												List<VirtualAccountBank> virtualAccountBanks = initCriteria(true)
														.list();

												int size = virtualAccountBanks.size();

												for (VirtualAccountBank virtualAccountBank : virtualAccountBanks) {
													try {
														rowIndex++;
														String uraian = virtualAccountBank.getMahasiswa() == null
																? (virtualAccountBank.getBiodataCalonMahasiswa() == null
																		? ""
																		: virtualAccountBank.getBiodataCalonMahasiswa()
																				.toString())
																: virtualAccountBank.getMahasiswa().toString();
														double h = (rowIndex * 100.0) / size;
														label.setValue("Proses " + uraian + " ("
																+ Common.numberFormat.get().format(h) + "%)");

														JSONObject jsonObject2;

														if (virtualAccountBank.getPakaiva()) {

															jsonObject2 = Bankaltimtara
																	.checkPakaiva(virtualAccountBank);

														} else {

															jsonObject2 = Bankaltimtara
																	.checkPakaiqris(virtualAccountBank);

														}

														uraian += " ";

														uraian += virtualAccountBank.getJenisKegiatan() == null ? ""
																: virtualAccountBank.getJenisKegiatan()
																		.getNamaKegiatan();

														uraian += " ";

														uraian += virtualAccountBank.getJadwalPembayaran() == null ? ""
																: Common.dateFormat1.get()
																		.format(virtualAccountBank.getJadwalPembayaran()
																				.getStartDate())
																		+ " s.d "
																		+ Common.dateFormat1.get().format(virtualAccountBank
																				.getJadwalPembayaran().getEndDate());

														uraian += " ";

														uraian += (virtualAccountBank.getKegiatan() == null
																&& virtualAccountBank.getPembayaran() == null)
																		? "Belum dibayar"
																		: "Telah dibayar " + virtualAccountBank
																				.getKegiatan().toString();

														XSSFRow row = sheet.createRow(rowIndex);
														row.createCell(0).setCellValue(virtualAccountBank.getKode());
														row.createCell(1).setCellValue(uraian);
														row.createCell(2)
																.setCellValue(jsonObject2 == null ? "Tidak ada info"
																		: jsonObject2.toString());

													} catch (Exception e) {
														Common.tampilErrorJikaAdmin(e);

													}
												}

												try {
													FileOutputStream fileOut = new FileOutputStream(filename);
													workbook.write(fileOut);
													fileOut.close();
												} catch (IOException e) {
													// TODO Auto-generated catch block
													Common.tampilErrorJikaAdmin(e);
												}

												label.setValue("");
												virtualAccountBanks = null;
											}
										}).start();

									}

								}
							});

				}

			});
			button.setParent(find.getParent());
		}

		boolean aktifkan_va_bjb_langsung = Common.bolehKonfigurasi("aktifkan_va_bjb_langsung", Konfigurasi.TIDAK_AKTIF);
		if (aktifkan_va_bjb_langsung) {
			button = new MyToolbarbuttonConfig("Reconsile BJB", "/img/svg/check2-circle.svg");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {

					MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan rekonsiliasi (reconcile) seluruh data pembayaran melalui Bank BJB? Proses ini akan memeriksa dan menyelaraskan seluruh transaksi pembayaran BJB dengan data pada bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
							MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

								@SuppressWarnings("unchecked")
								@Override
								public void onEvent(Event event) throws Exception {
									int i = Integer.parseInt(event.getData().toString());
									if (i == MyMessageboxConfig.OK) {

										final String filename = Sessions.getCurrent().getWebApp()
												.getRealPath("/tmp/reconsile_bjb_"
														+ URLEncoder.encode(Common.datetimeFormat2s.get()
																.format(ais.ui.util.WaktuUtil.getDate()), "UTF-8")
														+ ".xlsx");

										final File file = new File(filename);
										file.getParentFile().mkdirs();
										file.createNewFile();

										final Label label = Common.displayLoadBar(new EventListener() {

											@Override
											public void onEvent(Event arg0) throws Exception {

												Filedownload.save(new FileInputStream(file),
														"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
														file.getName());

												onSearchDefault(null);
											}
										});

										new Thread(new Runnable() {

											@Override
											public void run() {

												XSSFWorkbook workbook = new XSSFWorkbook();
												XSSFSheet sheet = workbook
														.createSheet(Common.getBahasaConfig("CETAK DATA"));
												sheet.setDefaultColumnWidth(20);
												XSSFRow rowhead = sheet.createRow((short) 0);
												rowhead.createCell(0).setCellValue("VA");
												rowhead.createCell(1).setCellValue("Uraian");
												rowhead.createCell(2).setCellValue("Hasil");

												int rowIndex = 0;
												List<VirtualAccountBank> virtualAccountBanks = initCriteria(true)
														.add(Restrictions.ilike("bank", "BJB", MatchMode.EXACT)).list();
												int size = virtualAccountBanks.size();

												for (VirtualAccountBank virtualAccountBank : virtualAccountBanks) {
													try {
														rowIndex++;
														String uraian = virtualAccountBank.getMahasiswa() == null
																? (virtualAccountBank.getBiodataCalonMahasiswa() == null
																		? ""
																		: virtualAccountBank.getBiodataCalonMahasiswa()
																				.toString())
																: virtualAccountBank.getMahasiswa().toString();
														double h = (rowIndex * 100.0) / size;
														label.setValue("Proses " + uraian + " ("
																+ Common.numberFormat.get().format(h) + "%)");

														String postData = "";
														String cin = Common.getKonfigurasi("bjb_langsung_cin", "530")
																.getNilai();
														JSONObject hasil = BJBUtil.inquiryBillingBJB(postData, cin,
																virtualAccountBank.getKode(),
																virtualAccountBank.getBankHost() == null
																		? bankHostDefault
																		: virtualAccountBank.getBankHost(),
																true);

														uraian += " ";

														uraian += virtualAccountBank.getJenisKegiatan() == null ? ""
																: virtualAccountBank.getJenisKegiatan()
																		.getNamaKegiatan();

														uraian += " ";

														uraian += virtualAccountBank.getJadwalPembayaran() == null ? ""
																: Common.dateFormat1.get()
																		.format(virtualAccountBank.getJadwalPembayaran()
																				.getStartDate())
																		+ " s.d "
																		+ Common.dateFormat1.get().format(virtualAccountBank
																				.getJadwalPembayaran().getEndDate());

														uraian += " ";

														uraian += (virtualAccountBank.getKegiatan() == null
																&& virtualAccountBank.getPembayaran() == null)
																		? "Belum dibayar"
																		: "Telah dibayar " + virtualAccountBank
																				.getKegiatan().toString();

														XSSFRow row = sheet.createRow(rowIndex);
														row.createCell(0).setCellValue(virtualAccountBank.getKode());
														row.createCell(1).setCellValue(uraian);
														row.createCell(2).setCellValue(
																hasil == null ? "Tidak ada info" : hasil.toString());

													} catch (Exception e) {
														Common.tampilErrorJikaAdmin(e);

													}
												}

												try {
													FileOutputStream fileOut = new FileOutputStream(filename);
													workbook.write(fileOut);
													fileOut.close();
												} catch (IOException e) {
													// TODO Auto-generated catch block
													Common.tampilErrorJikaAdmin(e);
												}

												label.setValue("");
												virtualAccountBanks = null;
											}
										}).start();

									}

								}
							});

				}

			});
			button.setParent(find.getParent());
		}

		boolean aktifkan_pembayaran_via_bank_btn = Common.bolehKonfigurasi("aktifkan_pembayaran_via_bank_btn", Konfigurasi.TIDAK_AKTIF);
		if (aktifkan_pembayaran_via_bank_btn) {
			button = new MyToolbarbuttonConfig("Reconsile BTN", "/img/svg/check2-circle.svg");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {

					MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan rekonsiliasi (reconcile) seluruh data pembayaran melalui Bank BTN? Proses ini akan memeriksa dan menyelaraskan seluruh transaksi pembayaran BTN dengan data pada bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
							MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

								@SuppressWarnings("unchecked")
								@Override
								public void onEvent(Event event) throws Exception {
									int i = Integer.parseInt(event.getData().toString());
									if (i == MyMessageboxConfig.OK) {

										final String filename = Sessions.getCurrent().getWebApp()
												.getRealPath("/tmp/reconsile_btn_"
														+ URLEncoder.encode(Common.datetimeFormat2s.get()
																.format(ais.ui.util.WaktuUtil.getDate()), "UTF-8")
														+ ".xlsx");

										final File file = new File(filename);
										file.getParentFile().mkdirs();
										file.createNewFile();

										final Label label = Common.displayLoadBar(new EventListener() {

											@Override
											public void onEvent(Event arg0) throws Exception {

												Filedownload.save(new FileInputStream(file),
														"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
														file.getName());

												onSearchDefault(null);
											}
										});

										new Thread(new Runnable() {

											@Override
											public void run() {

												XSSFWorkbook workbook = new XSSFWorkbook();
												XSSFSheet sheet = workbook
														.createSheet(Common.getBahasaConfig("CETAK DATA"));
												sheet.setDefaultColumnWidth(20);
												XSSFRow rowhead = sheet.createRow((short) 0);
												rowhead.createCell(0).setCellValue("VA");
												rowhead.createCell(1).setCellValue("Uraian");
												rowhead.createCell(2).setCellValue("Hasil");

												int rowIndex = 0;
												List<VirtualAccountBank> virtualAccountBanks = initCriteria(true)
														.add(Restrictions.ilike("bank", "Bank BTN", MatchMode.EXACT))
														.list();
												int size = virtualAccountBanks.size();

												for (VirtualAccountBank virtualAccountBank : virtualAccountBanks) {
													try {
														rowIndex++;
														String uraian = virtualAccountBank.getMahasiswa() == null
																? (virtualAccountBank.getBiodataCalonMahasiswa() == null
																		? ""
																		: virtualAccountBank.getBiodataCalonMahasiswa()
																				.toString())
																: virtualAccountBank.getMahasiswa().toString();
														double h = (rowIndex * 100.0) / size;
														label.setValue("Proses " + uraian + " ("
																+ Common.numberFormat.get().format(h) + "%)");

														JSONObject hasil = DownloadTagihanMahasiswaBankBtn
																.inquiryBillingBTN(virtualAccountBank.getKode(),
																		virtualAccountBank.getBankHost(),
																		virtualAccountBank);

														uraian += " ";

														uraian += virtualAccountBank.getJenisKegiatan() == null ? ""
																: virtualAccountBank.getJenisKegiatan()
																		.getNamaKegiatan();

														uraian += " ";

														uraian += virtualAccountBank.getJadwalPembayaran() == null ? ""
																: Common.dateFormat1.get()
																		.format(virtualAccountBank.getJadwalPembayaran()
																				.getStartDate())
																		+ " s.d "
																		+ Common.dateFormat1.get().format(virtualAccountBank
																				.getJadwalPembayaran().getEndDate());

														uraian += " ";

														uraian += (virtualAccountBank.getKegiatan() == null
																&& virtualAccountBank.getPembayaran() == null)
																		? "Belum dibayar"
																		: "Telah dibayar "
																				+ (virtualAccountBank
																						.getPembayaran() == null
																								? ""
																								: virtualAccountBank
																										.getPembayaran()
																										.toString())
																				+ (virtualAccountBank
																						.getKegiatan() == null
																								? ""
																								: virtualAccountBank
																										.getKegiatan()
																										.toString());

														XSSFRow row = sheet.createRow(rowIndex);
														row.createCell(0).setCellValue(virtualAccountBank.getKode());
														row.createCell(1).setCellValue(uraian);
														row.createCell(2).setCellValue(
																hasil == null ? "Tidak ada info" : hasil.toString());

													} catch (Exception e) {
														Common.tampilErrorJikaAdmin(e);

													}
												}

												try {
													FileOutputStream fileOut = new FileOutputStream(filename);
													workbook.write(fileOut);
													fileOut.close();
												} catch (IOException e) {
													// TODO Auto-generated catch block
													Common.tampilErrorJikaAdmin(e);
												}

												label.setValue("");
												virtualAccountBanks = null;
											}
										}).start();

									}

								}
							});

				}

			});
			button.setParent(find.getParent());
		}

		boolean aktifkan_va_maja = Common.bolehKonfigurasi("aktifkan_va_maja", Konfigurasi.TIDAK_AKTIF);
		if (aktifkan_va_maja) {
			button = new MyToolbarbuttonConfig("Reconsile BSI", "/img/svg/check2-circle.svg");
			button.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {

					MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan rekonsiliasi (reconcile) seluruh data pembayaran melalui Bank BSI? Proses ini akan memeriksa dan menyelaraskan seluruh transaksi pembayaran BSI dengan data pada bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
							MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

								@SuppressWarnings("unchecked")
								@Override
								public void onEvent(Event event) throws Exception {
									int i = Integer.parseInt(event.getData().toString());
									if (i == MyMessageboxConfig.OK) {

										final String filename = Sessions.getCurrent().getWebApp()
												.getRealPath("/tmp/reconsile_BSI_"
														+ URLEncoder.encode(Common.datetimeFormat2s.get()
																.format(ais.ui.util.WaktuUtil.getDate()), "UTF-8")
														+ ".xlsx");

										final File file = new File(filename);
										file.getParentFile().mkdirs();
										file.createNewFile();

										final Label label = Common.displayLoadBar(new EventListener() {

											@Override
											public void onEvent(Event arg0) throws Exception {

												Filedownload.save(new FileInputStream(file),
														"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
														file.getName());

												onSearchDefault(null);
											}
										});

										new Thread(new Runnable() {

											@Override
											public void run() {

												XSSFWorkbook workbook = new XSSFWorkbook();
												XSSFSheet sheet = workbook
														.createSheet(Common.getBahasaConfig("CETAK DATA"));
												sheet.setDefaultColumnWidth(20);
												XSSFRow rowhead = sheet.createRow((short) 0);
												rowhead.createCell(0).setCellValue("VA");
												rowhead.createCell(1).setCellValue("Uraian");
												rowhead.createCell(2).setCellValue("Hasil");

												int rowIndex = 0;
												List<VirtualAccountBank> virtualAccountBanks = initCriteria(true)
														.add(Restrictions.ilike("bank", "Maja", MatchMode.EXACT))
														.list();
												int size = virtualAccountBanks.size();

												Session session = HibernateUtil.currentSession();
												for (VirtualAccountBank virtualAccountBankReadOnly : virtualAccountBanks) {
													try {
														rowIndex++;
														VirtualAccountBank virtualAccountBank = (VirtualAccountBank) session
																.createCriteria(VirtualAccountBank.class)
																.add(Restrictions
																		.idEq(virtualAccountBankReadOnly.getId()))
																.uniqueResult();

														String uraian = virtualAccountBank.getMahasiswa() == null
																? (virtualAccountBank.getBiodataCalonMahasiswa() == null
																		? ""
																		: virtualAccountBank.getBiodataCalonMahasiswa()
																				.toString())
																: virtualAccountBank.getMahasiswa().toString();
														double h = (rowIndex * 100.0) / size;
														label.setValue("Proses " + uraian + " ("
																+ Common.numberFormat.get().format(h) + "%)");

														String CLIENT_TOKEN = null;
														try {
															CLIENT_TOKEN = BSIMajaUtil.sendRequestToken(null,
																	virtualAccountBankReadOnly.getKanalPembayaran());
														} catch (Exception e1) {
															e1.printStackTrace(); ais.common.ErrorAuditUtil.record(e1, "auto-audit src/ais/action/master/VirtualAccountBankAction.java:1112");
														}

														JSONObject hasil = BSIMajaUtil.inqiery(virtualAccountBank,
																CLIENT_TOKEN, bankHostDefault);

														uraian += " ";

														uraian += virtualAccountBank.getJenisKegiatan() == null ? ""
																: virtualAccountBank.getJenisKegiatan()
																		.getNamaKegiatan();

														uraian += " ";

														uraian += virtualAccountBank.getJadwalPembayaran() == null ? ""
																: Common.dateFormat1.get()
																		.format(virtualAccountBank.getJadwalPembayaran()
																				.getStartDate())
																		+ " s.d "
																		+ Common.dateFormat1.get().format(virtualAccountBank
																				.getJadwalPembayaran().getEndDate());

														uraian += " ";

														uraian += (virtualAccountBank.getKegiatan() == null
																&& virtualAccountBank.getPembayaran() == null)
																		? "Belum dibayar"
																		: "Telah dibayar";

														XSSFRow row = sheet.createRow(rowIndex);
														row.createCell(0).setCellValue(virtualAccountBank.getKode());
														row.createCell(1).setCellValue(uraian);
														row.createCell(2).setCellValue(
																hasil == null ? "Tidak ada info" : hasil.toString());

													} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:1147");
//														Common.tampilErrorJikaAdmin(e);

													}
												}

												try {
													FileOutputStream fileOut = new FileOutputStream(filename);
													workbook.write(fileOut);
													fileOut.close();
												} catch (IOException e) {
													// TODO Auto-generated catch block
													Common.tampilErrorJikaAdmin(e);
												}

												label.setValue("");
												virtualAccountBanks = null;
											}
										}).start();

									}

								}
							});

				}

			});
			button.setParent(find.getParent());
		}
	}

	class VirtualAccountBankRenderer extends ais.ui.util.MyRowRenderer {

		boolean aktifkan_chek_ulang_bank_online = Common.bolehKonfigurasi("aktifkan_chek_ulang_bank_online", Konfigurasi.TIDAK_AKTIF);

		@Override
		public void render(final Row arg0, Object arg1) throws Exception {
			arg0.setValign("top");
			// TODO Auto-generated method stub
			final VirtualAccountBank virtualAccountBankReadOnly = (VirtualAccountBank) arg1;

			/*
			 * Renderer harus read-only. Versi lama melakukan update/commit saat baris grid dirender
			 * untuk mengisi waktuBayar dan membuat record Va. Saat banyak user membuka daftar VA,
			 * update dari renderer mudah berbenturan dengan callback bank sehingga muncul
			 * statement timeout dan transaksi Hibernate menjadi aborted. Data korektif seperti
			 * waktu bayar dan relasi VA sekarang hanya ditampilkan tanpa memaksa update database.
			 */
			final Date waktuBayarRender = resolveWaktuBayarUntukTampilan(virtualAccountBankReadOnly);

			Vbox aaa;
			(aaa = RevisiHelper.createNewRevisi(VirtualAccountBank.class, virtualAccountBankReadOnly,
					virtualAccountBankReadOnly.getKode())).setParent(arg0);
			if (virtualAccountBankReadOnly.getBankHost() != null) {
				new Label(virtualAccountBankReadOnly.getBankHost().getNama()).setParent(aaa);
			}

			if (virtualAccountBankReadOnly.getKanalPembayaran() != null) {
				new Label(virtualAccountBankReadOnly.getKanalPembayaran().getNama()).setParent(aaa);
			}

			new MyLabelKecilSekali(virtualAccountBankReadOnly.getNama()).setParent(aaa);

			if (virtualAccountBankReadOnly.getLink() != null && !virtualAccountBankReadOnly.getLink().isEmpty()) {
				A a;
				(a = new A(virtualAccountBankReadOnly.getLink())).setParent(aaa);
				a.setStyle("font-size:7px");
				a.setHref(virtualAccountBankReadOnly.getLink());
				a.setTarget("_blank");
			}

			if (virtualAccountBankReadOnly.getAnggotaKoperasi() != null) {
				new MyLabelKecil(virtualAccountBankReadOnly.getAnggotaKoperasi().getKode() + " - "
						+ virtualAccountBankReadOnly.getAnggotaKoperasi().getNama()).setParent(arg0);
				new MyLabelKecil(virtualAccountBankReadOnly.getAnggotaKoperasi().getJenisAnggotaKoperasi() + " - "
						+ virtualAccountBankReadOnly.getAnggotaKoperasi().getJenisAnggotaKoperasi().getNama())
						.setParent(arg0);
			} else {

				aaa = new Vbox();
				aaa.setParent(arg0);
				new MyLabelKecil(virtualAccountBankReadOnly.getMahasiswa() == null
						? (virtualAccountBankReadOnly.getBiodataCalonMahasiswa() == null
								? (virtualAccountBankReadOnly.getSiswa() == null
										? (virtualAccountBankReadOnly.getCalonSiswa() == null ? ""
												: virtualAccountBankReadOnly.getCalonSiswa().toString())
										: virtualAccountBankReadOnly.getSiswa().toString())
								: virtualAccountBankReadOnly.getBiodataCalonMahasiswa().toString())
						: virtualAccountBankReadOnly.getMahasiswa().toString()).setParent(aaa);

				String kelas = virtualAccountBankReadOnly.getKelas();
				if (kelas != null && !kelas.trim().isEmpty()) {
					new MyLabelKecil(kelas).setParent(aaa);
				}

				try {
					new MyLabelKecil(
							virtualAccountBankReadOnly.getMahasiswa() == null
									? (virtualAccountBankReadOnly.getBiodataCalonMahasiswa() == null
											? (virtualAccountBankReadOnly.getSiswa() == null
													? (virtualAccountBankReadOnly.getCalonSiswa() == null ? ""
															: virtualAccountBankReadOnly
																	.getCalonSiswa().getSekolah().getNama())
													: virtualAccountBankReadOnly.getSiswa().getSekolah().getNama())
											: (virtualAccountBankReadOnly.getBiodataCalonMahasiswa()
													.getProdiLulus() == null
															? (virtualAccountBankReadOnly.getBiodataCalonMahasiswa()
																	.getProdi1() == null
																			? ""
																			: virtualAccountBankReadOnly
																					.getBiodataCalonMahasiswa()
																					.getProdi1().getNama())
															: virtualAccountBankReadOnly.getBiodataCalonMahasiswa()
																	.getProdiLulus().getNama()))
									: virtualAccountBankReadOnly.getMahasiswa().getJurusan().getNama())
							.setParent(arg0);
				} catch (Exception e) {
					new Label().setParent(arg0);
				}
			}

			AkunPembayaranSiswa akunPembayaranSiswaTampilan = resolveAkunPembayaranSiswaUntukTampilan(virtualAccountBankReadOnly);

			if (virtualAccountBankReadOnly.getCaraPembayaranKoperasi() != null) {
				new MyLabelKecil(virtualAccountBankReadOnly.getCaraPembayaranKoperasi().getKode() + " - "
						+ virtualAccountBankReadOnly.getCaraPembayaranKoperasi().getNama()).setParent(arg0);
				new MyLabelKecil(virtualAccountBankReadOnly.getAnggotaKoperasi().getTipeAnggotaKoperasi() + " - "
						+ virtualAccountBankReadOnly.getAnggotaKoperasi().getTipeAnggotaKoperasi().getNama())
						.setParent(arg0);
			} else {
				new Label(virtualAccountBankReadOnly.getJenisKegiatan() == null
						? (akunPembayaranSiswaTampilan == null ? "" : akunPembayaranSiswaTampilan.getNama())
						: virtualAccountBankReadOnly.getJenisKegiatan().getNamaKegiatan()).setParent(arg0);

				new MyLabelKecilSekali(virtualAccountBankReadOnly.getJadwalPembayaran() == null
						? virtualAccountBankReadOnly.getCicilan()
						: Common.dateFormat1.get().format(virtualAccountBankReadOnly.getJadwalPembayaran().getStartDate())
								+ " s.d "
								+ Common.dateFormat1.get().format(virtualAccountBankReadOnly.getJadwalPembayaran().getEndDate()))
						.setParent(arg0);
			}
			new Label(virtualAccountBankReadOnly.getKadaluarsaWaktu() == null ? ""
					: Common.dateFormat.get().format(virtualAccountBankReadOnly.getKadaluarsaWaktu())).setParent(arg0);
			new Label("Rp. " + Common.numberFormat.get().format(virtualAccountBankReadOnly.getTotal())).setParent(arg0);
			new Label("Rp. " + Common.numberFormat.get().format(virtualAccountBankReadOnly.getBiayaAdmin())).setParent(arg0);
			new Label("Rp. " + Common.numberFormat.get().format(virtualAccountBankReadOnly.getTopup())).setParent(arg0);
			buatStatusPembayaran(virtualAccountBankReadOnly).setParent(arg0);

			Vbox vbox = new Vbox();
			vbox.setParent(arg0);
			new MyLabelKecilSekali(virtualAccountBankReadOnly.getKeterangan()).setParent(vbox);
			new MyLabelKecilSekali(virtualAccountBankReadOnly.getNotif()).setParent(vbox);

			Hbox hbox = new Hbox();
			final String bankVirtualAccount = virtualAccountBankReadOnly.getBank() == null ? ""
					: virtualAccountBankReadOnly.getBank();

//			if (virtualAccountBankReadOnly.getPembayaran() != null
//					&& virtualAccountBankReadOnly.getWaktuBayar() != null
//					&& virtualAccountBankReadOnly.getNotif() != null
//					&& !virtualAccountBankReadOnly.getNotif().isEmpty()) {
//				MyToolbarbuttonConfig button = new MyToolbarbuttonConfig("Verif Ulang", "/img/svg/check2-circle.svg");
//				button.addEventListener("onClick", new EventListener() {
//					@Override
//					public void onEvent(Event event) throws Exception {
//
//						MyMessageboxConfig.show("Apakah yakin ingin verifikasi ulang pada transaksi ini ?", "Pertanyaan",
//								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {
//
//									@Override
//									public void onEvent(Event event) throws Exception {
//										int i = Integer.parseInt(event.getData().toString());
//										if (i == MyMessageboxConfig.OK) {
//											try {
//												Session session = HibernateUtil.currentNativeSession();
//												VirtualAccountBank.bayarSiswa(virtualAccountBankReadOnly, session,
//														virtualAccountBankReadOnly.getWaktuBayar(),
//														virtualAccountBankReadOnly.getBank(), false,
//														virtualAccountBankReadOnly.getNotif());
//												// session.disconnect();
//												if (session.isOpen()) {session.disconnect();session.close();}
//												HibernateUtil.closeSession();
//											} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:1330");
//												Common.tampilErrorJikaAdmin(e);
//												MyMessageboxConfig.show(
//														"Data ini tidak dapat Cek Pembayaran .., error-nya adalah sbagai berikut:"
//																+ e.getMessage());
//											}
//
//										}
//
//									}
//								});
//
//					}
//
//				});
//				button.setParent(hbox);
//			}

			if (aktifkan_chek_ulang_bank_online
					&& bankVirtualAccount.equalsIgnoreCase("Bank Online")) {
				MyToolbarbuttonConfig button = new MyToolbarbuttonConfig("Jadikan Terbayar",
						"/img/svg/check2-circle.svg");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin mengubah status transaksi ini menjadi TERBAYAR? Perubahan status ini akan menandai transaksi sebagai telah dibayar. Mohon pastikan pembayaran benar-benar telah diterima. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.",
								"Pertanyaan", MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION,
								new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												Maja.doProcess(virtualAccountBankReadOnly.getTotal().intValue(),
														Common.databaseDateFormat1.get().format(new Date()),
														virtualAccountBankReadOnly.getKode(),
														virtualAccountBankReadOnly.getBank(), bankHostDefault, null,
														"Jadikan Terbayar", true);

												onSearchDefault(event);

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (bankVirtualAccount.equalsIgnoreCase("Esmartlink")
					&& virtualAccountBankReadOnly.getResponse() != null
					&& !virtualAccountBankReadOnly.getResponse().isEmpty()) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {
												if (virtualAccountBankReadOnly.getResponse() != null
														&& !virtualAccountBankReadOnly.getResponse().isEmpty()) {
													JSONObject req = new JSONObject(
															virtualAccountBankReadOnly.getResponse());
													JSONObject dataReq = req.getJSONObject("data");
													String transaction_id = dataReq.get("transaction_id") + "";

													String linkPost = Common.getKonfigurasi("url_status_va_smartlink",
															"https://payment-service.pakar-digital.com/api/payment/inquiry-order/")
															.getNilai().trim() + transaction_id;

													String username_va_e_smartlink = Common
															.getKonfigurasi("username_va_e_smartlink",
																	"<REDACTED_USERNAME>")
															.getNilai().trim();
													String password_va_e_smartlink = Common
															.getKonfigurasi("password_va_e_smartlink",
																	"<REDACTED_PASSWORD>")
															.getNilai().trim();

													if (virtualAccountBankReadOnly.getSiswa() != null) {
														username_va_e_smartlink = virtualAccountBankReadOnly.getSiswa()
																.getSekolah().getUsernameEsmartlink();
														password_va_e_smartlink = virtualAccountBankReadOnly.getSiswa()
																.getSekolah().getPasswordEsmartlink();

													} else if (virtualAccountBankReadOnly.getCalonSiswa() != null) {
														username_va_e_smartlink = virtualAccountBankReadOnly
																.getCalonSiswa().getSekolah().getUsernameEsmartlink();
														password_va_e_smartlink = virtualAccountBankReadOnly
																.getCalonSiswa().getSekolah().getPasswordEsmartlink();

													}

													if (virtualAccountBankReadOnly != null && virtualAccountBankReadOnly
															.getKanalPembayaran() != null) {
														username_va_e_smartlink = virtualAccountBankReadOnly
																.getKanalPembayaran().getUsernameEsmartlink();
														password_va_e_smartlink = virtualAccountBankReadOnly
																.getKanalPembayaran().getPasswordEsmartlink();
													}

													JSONObject jsonObject2 = null;
													boolean sudahTerbayar = false;

													try {

														String hasil = VirtualAccountBank.curlSmartlinkGet(linkPost,
																username_va_e_smartlink, password_va_e_smartlink);

//														System.out.println("hasil -> " + hasil);
														jsonObject2 = new JSONObject(hasil);
														String status = jsonObject2.isNull("data")
																|| jsonObject2.getJSONObject("data").isNull("status")
																		? "ERROR"
																		: jsonObject2.getJSONObject("data")
																				.get("status") + "";
														boolean masuk = status.trim().equalsIgnoreCase("success");

														if (masuk) {
															sudahTerbayar = true;

															Esmartlink.doProses(hasil, null,
																	virtualAccountBankReadOnly.getBankHost() == null
																			? bankHostDefault
																			: virtualAccountBankReadOnly.getBankHost(),
																	virtualAccountBankReadOnly.getBank(), true);
														}
													} catch (Exception e) {
														ais.common.Common.tampilErrorJikaAdmin(e);
													}

													tampilkanHasilCekPembayaran(
															sudahTerbayar ? "Status gateway: pembayaran ditemukan."
																	: "Status gateway: pembayaran belum ditemukan.",
															jsonObject2,
															sudahTerbayar ? MyMessageboxConfig.INFORMATION
																	: MyMessageboxConfig.EXCLAMATION);

													refreshSetelahCekPembayaran();
												}
											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (bankVirtualAccount.equalsIgnoreCase("Maja")) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												String CLIENT_TOKEN = null;
												try {
													CLIENT_TOKEN = BSIMajaUtil.sendRequestToken(null,
															virtualAccountBankReadOnly.getKanalPembayaran());
												} catch (Exception e1) {
													e1.printStackTrace(); ais.common.ErrorAuditUtil.record(e1, "auto-audit src/ais/action/master/VirtualAccountBankAction.java:1521");
												}
												Session session = HibernateUtil.currentSession();
												VirtualAccountBank virtualAccountBank = (VirtualAccountBank) session
														.createCriteria(VirtualAccountBank.class)
														.add(Restrictions.idEq(virtualAccountBankReadOnly.getId()))
														.uniqueResult();

												JSONObject bsi = BSIMajaUtil.inqiery(virtualAccountBank, CLIENT_TOKEN,
														bankHostDefault);

												JSONObject hasil = bsi.isNull("data") ? bsi : bsi.getJSONObject("data");

												if (hasil != null && !hasil.isNull("va")) {

													if (hasil.getBoolean("paid")) {
														if (Common.getApakahAdmin())
															MyMessageboxConfig.showFormat(
													"Berdasarkan hasil pemeriksaan, transaksi ini berstatus TELAH DIBAYAR. Pemeriksaan pembayaran berhasil dilakukan dengan rincian sebagai berikut:\n\n{V1}",
													"Pemberitahuan", MyMessageboxConfig.OK,
													MyMessageboxConfig.INFORMATION, bsi);
													} else {
														if (Common.getApakahAdmin())
															MyMessageboxConfig.showFormat(
													"Berdasarkan hasil pemeriksaan, transaksi ini berstatus BELUM DIBAYAR. Pemeriksaan pembayaran berhasil dilakukan dengan rincian sebagai berikut:\n\n{V1}",
													"Pemberitahuan", MyMessageboxConfig.OK,
													MyMessageboxConfig.INFORMATION, bsi);
													}

												} else {
													if (Common.getApakahAdmin())
														MyMessageboxConfig.show("Mohon maaf, proses pemeriksaan pembayaran tidak berhasil dilakukan. Langkah yang dapat dilakukan: (1) periksa kembali koneksi jaringan; (2) ulangi proses pemeriksaan beberapa saat lagi; (3) apabila masih berlanjut, mohon hubungi Administrator sistem.",
																"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
												}

												Common.createDefaultTimer(new EventListener() {

													@Override
													public void onEvent(Event arg0) throws Exception {
														onSearchDefault(null);
													}
												});

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (bankVirtualAccount.equalsIgnoreCase("Flip")
					&& virtualAccountBankReadOnly.getNotif() != null
					&& !virtualAccountBankReadOnly.getNotif().trim().isEmpty()) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												Flip.doProses(virtualAccountBankReadOnly.getNotif(), null,
														virtualAccountBankReadOnly.getBankHost() == null
																? bankHostDefault
																: virtualAccountBankReadOnly.getBankHost(),
														virtualAccountBankReadOnly.getBank(), true);

												Common.createDefaultTimer(new EventListener() {

													@Override
													public void onEvent(Event arg0) throws Exception {
														onSearchDefault(null);
													}
												});

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (bankVirtualAccount.equalsIgnoreCase("BJB")) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {
												String postData = "";
												String cin = Common.getKonfigurasi("bjb_langsung_cin", "530")
														.getNilai();
												JSONObject hasil = BJBUtil.inquiryBillingBJB(postData, cin,
														virtualAccountBankReadOnly.getKode(), bankHostDefault, true);

												if (hasil != null && !hasil.isNull("transactions")) {
													if (Common.getApakahAdmin())
														MyMessageboxConfig.showFormat(
								"Pemeriksaan pembayaran berhasil dilakukan dengan rincian sebagai berikut: {V1}",
								"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION, hasil.getJSONObject("transactions"));
												} else if (hasil != null && hasil.isNull("transactions")) {
													if (Common.getApakahAdmin())
														MyMessageboxConfig.showFormat(
								"Transaksi ini belum dibayar. Rincian informasi: {V1}",
								"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION, hasil.toString());
												} else {
													if (Common.getApakahAdmin())
														MyMessageboxConfig.show("Mohon maaf, proses pemeriksaan pembayaran tidak berhasil dilakukan. Langkah yang dapat dilakukan: (1) periksa kembali koneksi jaringan; (2) ulangi proses pemeriksaan beberapa saat lagi; (3) apabila masih berlanjut, mohon hubungi Administrator sistem.",
																"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
												}

												Common.createDefaultTimer(new EventListener() {

													@Override
													public void onEvent(Event arg0) throws Exception {
														onSearchDefault(null);
													}
												});

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (bankVirtualAccount.equalsIgnoreCase("Bank BTN")) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {
												JSONObject hasil = null;
												if ((virtualAccountBankReadOnly.getPembayaran() != null
														|| virtualAccountBankReadOnly.getKegiatan() != null)
														&& virtualAccountBankReadOnly.getNotif() != null
														&& !virtualAccountBankReadOnly.getNotif().isEmpty()) {
													String body = ais.action.servlet.Va.doProses(
															virtualAccountBankReadOnly.getNotif(), null,
															virtualAccountBankReadOnly.getBankHost(), true);
													hasil = new JSONObject(body);
												} else {

													hasil = DownloadTagihanMahasiswaBankBtn.inquiryBillingBTN(
															virtualAccountBankReadOnly.getKode(),
															virtualAccountBankReadOnly.getBankHost(),
															virtualAccountBankReadOnly);
												}

												if (hasil != null && !hasil.isNull("terbayar")) {

													Double nominalP = 0.0;
													try {
														nominalP = Double.parseDouble(hasil.get("terbayar") + "");
													} catch (Exception e) {
														nominalP = 0.0;
													}
													if (nominalP > 0.1) {
														MyMessageboxConfig.showFormat(
								"Pemeriksaan pembayaran berhasil dilakukan.\n {V1}",
								"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION, (Common.getApakahAdmin() ? hasil : ""));
													} else {

														MyMessageboxConfig.showFormat(
								"Transaksi ini belum melakukan pembayaran.\n{V1}",
								"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION, (Common.getApakahAdmin() ? hasil : ""));
													}
												} else {

													MyMessageboxConfig.showFormat(
							"Mohon maaf, pemeriksaan pembayaran gagal dilakukan. Rincian informasi: {V1}",
							"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION, hasil);
												}

												Common.createDefaultTimer(new EventListener() {

													@Override
													public void onEvent(Event arg0) throws Exception {
														onSearchDefault(null);
													}
												});

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (virtualAccountBankReadOnly.getNotif() != null
					&& virtualAccountBankReadOnly.getNotif().contains("transmissionDateTime")) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												Mandiri.doProses(virtualAccountBankReadOnly.getNotif(), null,
														virtualAccountBankReadOnly.getBankHost() == null
																? bankHostDefault
																: virtualAccountBankReadOnly.getBankHost(),
														virtualAccountBankReadOnly.getBank(), true);

												Common.createDefaultTimer(new EventListener() {

													@Override
													public void onEvent(Event arg0) throws Exception {
														onSearchDefault(null);
													}
												});

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			// "Bank Bankaltimtara" = nilai awal saat VA dibuat; "BMS" = nilai yang
			// ditulis Bankaltimtara.java begitu 1x notifikasi H2H masuk (lihat
			// Bankaltimtara.process(): "String bank = \"BMS\";", hardcode). Tanpa
			// meng-OR-kan kedua nilai ini, tombol Cek Ulang HILANG persis pada VA yang
			// paling butuh dicek ulang (sudah pernah dapat notifikasi tapi status di
			// SIAKAD masih meragukan).
			if (bankVirtualAccount.equalsIgnoreCase("Bank Bankaltimtara")
					|| bankVirtualAccount.equalsIgnoreCase("BMS")) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												if (virtualAccountBankReadOnly.getPakaiva()) {

													JSONObject jsonObject2 = Bankaltimtara
															.checkPakaiva(virtualAccountBankReadOnly);

													MyMessageboxConfig.showFormat(
										"Informasi hasil pemeriksaan status pembayaran: {V1}",
										"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION, jsonObject2);

													Common.createDefaultTimer(new EventListener() {

														@Override
														public void onEvent(Event arg0) throws Exception {
															onSearchDefault(null);
														}
													});
												} else {

													JSONObject jsonObject2 = Bankaltimtara
															.checkPakaiqris(virtualAccountBankReadOnly);

													MyMessageboxConfig.showFormat(
										"Informasi hasil pemeriksaan status pembayaran: {V1}",
										"Pemberitahuan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION, jsonObject2);

													Common.createDefaultTimer(new EventListener() {

														@Override
														public void onEvent(Event arg0) throws Exception {
															onSearchDefault(null);
														}
													});

												}

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (virtualAccountBankReadOnly.getMahasiswa() != null
					&& bankVirtualAccount.equalsIgnoreCase("bankaltimtara baru")) {
				MyToolbarbuttonConfig button = buatTombolCekUlang("Cek Ulang");
				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin melakukan pemeriksaan ulang (cek ulang) status pembayaran pada transaksi ini? Sistem akan memeriksa kembali status pembayaran melalui gateway bank. Silakan tekan OK untuk melanjutkan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												String linkPost = Common
														.getKonfigurasi("url_status_va_bankaltimtara_baru",
																"http://<REDACTED_HOST>:8017/ubt/status_va")
														.getNilai().trim();

												String signatureKey = Common
														.getKonfigurasi("key_bankaltimtara_baru",
																"<REDACTED_API_KEY>")
														.getNilai().trim();
												String appId = Common.getKonfigurasi("app_id_bankaltimtara_baru",
														"<REDACTED_APP_ID>").getNilai().trim();

												String payload = appId + ";status_va:"
														+ (virtualAccountBankReadOnly.getBiodataCalonMahasiswa() != null
																? virtualAccountBankReadOnly.getBiodataCalonMahasiswa()
																		.getNoRegistrasi()
																: virtualAccountBankReadOnly.getMahasiswa().getNim());

												String signature = Common.buildHmacSignature(payload, signatureKey);

												JSONObject jsonObject = new JSONObject();
												jsonObject.put("npm",
														(virtualAccountBankReadOnly.getBiodataCalonMahasiswa() != null
																? virtualAccountBankReadOnly.getBiodataCalonMahasiswa()
																		.getNoRegistrasi()
																: virtualAccountBankReadOnly.getMahasiswa().getNim()));

												String[] command = { "curl", "--location", "--request", "GET", linkPost,
														"--header", "Content-Type: application/json", "--header",
														"signature: " + signature, "--data", jsonObject.toString() };

												System.out.println("linkPost -> " + linkPost);
												System.out.println("signature -> " + signature);
												System.out.println("data -> " + jsonObject.toString());

												JSONObject jsonObject2 = null;
												boolean sudahTerbayar = false;

												try {

													ProcessBuilder process = new ProcessBuilder(command);
													Process p;
													p = process.start();
													BufferedReader reader = new BufferedReader(
															new InputStreamReader(p.getInputStream()));
													StringBuilder builder = new StringBuilder();
													String line;
													while ((line = reader.readLine()) != null) {
														builder.append(line);
														builder.append(System.getProperty("line.separator"));
													}
													String hasil = builder.toString();

//													System.out.println("hasil -> " + hasil);

													jsonObject2 = new JSONObject(hasil);

													JSONArray data = jsonObject2.getJSONArray("data");
													for (i = 0; i < data.length(); i++) {
														try {
															JSONObject object = data.getJSONObject(i);
															if (virtualAccountBankReadOnly.getSemester().equals(Integer
																	.parseInt((object.get("semester") + "").trim()))) {
																Double paid = Double
																		.parseDouble((object.get("paid") + "").trim());
																if (paid.intValue() == virtualAccountBankReadOnly
																		.getTotal().intValue()) {
																	sudahTerbayar = true;
																	Session sessionBayar = null;
																	try {
																		sessionBayar = HibernateUtil.currentNativeSession();
																		VirtualAccountBank.bayarVa(
																				virtualAccountBankReadOnly,
																				WaktuUtil.getDate(), hasil, sessionBayar);
																	} catch (Exception e) {
																		ais.common.Common.tampilErrorJikaAdmin(e);
																	} finally {
																		Common.closeNativeSessionQuietly(sessionBayar);
																	}
																}
															}
														} catch (Exception e) {
															ais.common.Common.tampilErrorJikaAdmin(e);
														}
													}

												} catch (Exception e) {
													ais.common.Common.tampilErrorJikaAdmin(e);
												}

												tampilkanHasilCekPembayaran(
														sudahTerbayar ? "Status gateway: pembayaran ditemukan."
																: "Status gateway: pembayaran belum ditemukan.",
														jsonObject2,
														sudahTerbayar ? MyMessageboxConfig.INFORMATION : MyMessageboxConfig.EXCLAMATION);

												refreshSetelahCekPembayaran();

											} catch (Exception e) {
												tampilkanErrorCekPembayaran(e);
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);
			}

			if (virtualAccountBankReadOnly.getKegiatan() == null && tbmuser != null && tbmuser.getMahasiswa() == null
					&& tbmuser.getSiswa() == null) {
				final MyToolbarbuttonConfig button = new MyToolbarbuttonConfig("Hapus", "/img/svg/warning-outline.svg");
				final MyCheckboxConfig checkbox = new MyCheckboxConfig("Kendala");
				checkbox.setDisabled(tbmuser == null || tbmuser.getMahasiswa() != null);
				checkbox.setChecked(Boolean.TRUE.equals(virtualAccountBankReadOnly.getTerjadiKendala()));
				checkbox.setParent(arg0);
				arg0.setAttribute("checkbox", checkbox);
				checkbox.addEventListener("onCheck", new EventListener() {

					@Override
					public void onEvent(Event arg0) throws Exception {
						Long va = virtualAccountBankReadOnly.getId();
						Boolean kendala = checkbox.isChecked();
						Session sessionBaru = null;
						Transaction transaction = null;
						try {
							sessionBaru = HibernateUtil.currentNativeSession();
							transaction = sessionBaru.getTransaction();
							transaction.begin();
							sessionBaru.createSQLQuery("update virtual_account_bank set terjadikendala=" + kendala
									+ " where id=" + va + ";").executeUpdate();
							virtualAccountBankReadOnly.setTerjadiKendala(kendala);
							Common.refreshUpdate(sessionBaru, virtualAccountBankReadOnly);
							transaction.commit();
						} catch (Exception e) {
							Common.rollbackQuietly(transaction);
							tampilkanErrorCekPembayaran(e);
							checkbox.setChecked(!checkbox.isChecked());
						} finally {
							Common.closeNativeSessionQuietly(sessionBaru);
						}

						button.setDisabled(!checkbox.isChecked());

					}
				});

				button.setDisabled(!Boolean.TRUE.equals(virtualAccountBankReadOnly.getTerjadiKendala()));
				button.setTooltiptext("Hapus data VA yang ditandai kendala. Gunakan hanya setelah data pembayaran dipastikan aman.");
				button.setOrient("vertical");

				boolean bolehMerubahCicilan = false;
				String admLain = Common.getKonfigurasi("admin_yang_bisa_menghapus_data_pembayaran_va", "").getNilai();
				String[] aa = admLain.split(";");
				for (String a : aa) {
					try {
						bolehMerubahCicilan = a.trim().equalsIgnoreCase(tbmuser.getUserId());
						if (bolehMerubahCicilan) {
							break;
						}
					} catch (Exception e) {
						Common.tampilErrorJikaAdmin(e);
					}
				}

				button.setVisible(bolehMerubahCicilan);

				button.addEventListener("onClick", new EventListener() {
					@Override
					public void onEvent(Event event) throws Exception {

						MyMessageboxConfig.show("Apakah Bapak/Ibu yakin ingin menghapus data pembayaran ini? Data yang telah dihapus tidak dapat dikembalikan lagi. Silakan tekan OK untuk melanjutkan penghapusan, atau Batal untuk membatalkan.", "Pertanyaan",
								MyMessageboxConfig.OK | MyMessageboxConfig.CANCEL, MyMessageboxConfig.QUESTION, new EventListener() {

									@Override
									public void onEvent(Event event) throws Exception {
										int i = Integer.parseInt(event.getData().toString());
										if (i == MyMessageboxConfig.OK) {
											try {

												Long va = virtualAccountBankReadOnly.getId();
												Session sessionBaru = null;
												Transaction transaction = null;
												try {
													sessionBaru = HibernateUtil.currentNativeSession();
													transaction = sessionBaru.getTransaction();
													transaction.begin();
													sessionBaru.createSQLQuery(
															"delete from virtual_account_bank where id=" + va + ";")
															.executeUpdate();
													transaction.commit();
												} catch (Exception e) {
													Common.rollbackQuietly(transaction);
													throw e;
												} finally {
													Common.closeNativeSessionQuietly(sessionBaru);
												}

												onSearchDefault(null);

											} catch (Exception e) {
												Common.tampilErrorJikaAdmin(e);
												MyMessageboxConfig.showFormat(
										"Mohon maaf, data ini tidak dapat dihapus. Rincian teknis: {V1}. Langkah yang dapat dilakukan: (1) pastikan tidak ada data lain yang masih menggunakan data ini; (2) hapus terlebih dahulu data yang berkaitan; (3) apabila masih berlanjut, mohon hubungi Administrator sistem.",
										"Informasi", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION, e.getMessage());
											}

										}

									}
								});

					}

				});
				button.setParent(hbox);

			} else {
				new Label(Boolean.TRUE.equals(virtualAccountBankReadOnly.getTerjadiKendala()) ? "Ya" : "Tidak").setParent(arg0);
				new Label("").setParent(hbox);
			}

			hbox.setParent(arg0);
		}

	}


	private Date resolveWaktuBayarUntukTampilan(VirtualAccountBank virtualAccountBank) {
		if (virtualAccountBank == null) {
			return null;
		}
		if (virtualAccountBank.getWaktuBayar() != null) {
			return virtualAccountBank.getWaktuBayar();
		}
		if (virtualAccountBank.getKegiatan() == null || virtualAccountBank.getId() == null) {
			return null;
		}
		Session sessionBaru = null;
		try {
			sessionBaru = HibernateUtil.openSession();
			sessionBaru.setFlushMode(FlushMode.MANUAL);
			return (Date) sessionBaru.createCriteria(CicilanPembayaran.class)
					.add(Restrictions.eq("refVa", virtualAccountBank.getId()))
					.setProjection(Projections.property("tanggal")).setMaxResults(1).uniqueResult();
		} catch (Exception e) {
			return null;
		} finally {
			Common.closeNativeSessionQuietly(sessionBaru);
		}
	}

	private AkunPembayaranSiswa resolveAkunPembayaranSiswaUntukTampilan(VirtualAccountBank virtualAccountBank) {
		if (virtualAccountBank == null) {
			return null;
		}
		AkunPembayaranSiswa akun = virtualAccountBank.getAkunPembayaranSiswa();
		if (akun != null) {
			return akun;
		}
		Sekolah sekolah = null;
		try {
			if (virtualAccountBank.getSiswa() != null) {
				sekolah = virtualAccountBank.getSiswa().getSekolah();
			} else if (virtualAccountBank.getCalonSiswa() != null) {
				sekolah = virtualAccountBank.getCalonSiswa().getSekolah();
			}
		} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:2160");
		}
		if (sekolah == null) {
			return null;
		}
		Session sessionBaru = null;
		try {
			sessionBaru = HibernateUtil.openSession();
			sessionBaru.setFlushMode(FlushMode.MANUAL);
			return (AkunPembayaranSiswa) ConstantValues.simpleObject(
					sessionBaru.createCriteria(AkunPembayaranSiswa.class)
							.add(Restrictions.or(Restrictions.isNull("aktif"), Restrictions.eq("aktif", true)))
							.add(Restrictions.eq("manual", false))
							.add(Restrictions.eq("dariTabungan", false))
							.add(Restrictions.eq("sekolah", sekolah)).setMaxResults(1),
					AkunPembayaranSiswa.class);
		} catch (Exception e) {
			return null;
		} finally {
			Common.closeNativeSessionQuietly(sessionBaru);
		}
	}


	@SuppressWarnings("unchecked")
	public Criteria initCriteria(boolean order) {

		String mhs = mahasiswa.getValue().trim();
		Sekolah sekolah = (Sekolah) (searchsekolah == null || searchsekolah.getSelectedItem() == null ? null
				: searchsekolah.getSelectedItem().getValue());
		Yayasan yayasan = (Yayasan) (searchyayasan == null || searchyayasan.getSelectedItem() == null ? null
				: searchyayasan.getSelectedItem().getValue());

		Jurusan jurusan = (Jurusan) (searchjurusan == null || searchjurusan.getSelectedItem() == null ? null
				: searchjurusan.getSelectedItem().getValue());
		Fakultas fakultas = (Fakultas) (searchfakultas == null || searchfakultas.getSelectedItem() == null ? null
				: searchfakultas.getSelectedItem().getValue());

		if (fakultas != null || jurusan != null || !ya) {
			sekolah = null;
			yayasan = null;
		}

		PerguruanTinggi perguruanTinggi = Common.bolehKonfigurasi("va_tampil_semua_di_pt") ? null : PerguruanTinggiUtil.getPerguruanTinggi();

		List<String> banks = new ArrayList<String>();
		if (selectedBank != null && !selectedBank.trim().isEmpty()) {
			for (String ss : selectedBank.split(",")) {
				banks.add(ss);
			}
		}

		Session session = HibernateUtil.currentSession();
		Criteria criteria = session.createCriteria(VirtualAccountBank.class)

				.add(!banks.isEmpty() ? Restrictions.in("bank", banks) : Restrictions.sqlRestriction("true"))

				.createAlias("bankHost", "bankHost", Criteria.LEFT_JOIN)
				.add(userAccessRestriction())

				.add(perguruanTinggi == null || perguruanTinggi.getId() == null ? Restrictions.sqlRestriction("true")
						: Restrictions.or(Restrictions.isNull("pt"), Restrictions.eq("pt", perguruanTinggi.getId())));

		criteria.createAlias("mahasiswa", "mahasiswa", Criteria.LEFT_JOIN)
				.createAlias("biodataCalonMahasiswa", "biodataCalonMahasiswa", Criteria.LEFT_JOIN)
				.createAlias("siswa", "siswa", Criteria.LEFT_JOIN)
				.createAlias("calonSiswa", "calonSiswa", Criteria.LEFT_JOIN);

		if (jenis != null && !jenis.getValue().trim().isEmpty()) {
			criteria.createAlias("jenisKegiatan", "jenisKegiatan", Criteria.LEFT_JOIN)
					.createAlias("akunPembayaranSiswa", "akunPembayaranSiswa", Criteria.LEFT_JOIN)
					.add(Restrictions.or(
							Restrictions.ilike("jenisKegiatan.nama", jenis.getValue().trim(), MatchMode.ANYWHERE),
							Restrictions.ilike("akunPembayaranSiswa.nama", jenis.getValue().trim(),
									MatchMode.ANYWHERE)));
		}

		if (tbmuser != null && tbmuser.getOrangTua() != null && !tbmuser.getOrangTua().ambilAnakSiswa().isEmpty()) {
			criteria.add(Restrictions.in("siswa.id", tbmuser.getOrangTua().ambilAnakSiswa()));
		}
		if (tbmuser != null && tbmuser.getOrangTua() != null && !tbmuser.getOrangTua().ambilAnakMahasiswa().isEmpty()) {
			criteria.add(Restrictions.in("mahasiswa.id", tbmuser.getOrangTua().ambilAnakMahasiswa()));
		}

		if (!mhs.isEmpty() || (sekolah != null && sekolah.getId() != null)
				|| (yayasan != null && yayasan.getId() != null) || (jurusan != null && jurusan.getId() != null)
				|| (fakultas != null && fakultas.getId() != null)) {

			List<Long> longsJurusans = fakultas != null && fakultas.getId() != null
					? session.createCriteria(Jurusan.class).add(Restrictions.eq("aktif", true))
							.setProjection(Projections.property("id")).add(Restrictions.eq("fakultas", fakultas)).list()
					: null;

			criteria.add(sekolah == null || sekolah.getId() == null ? Restrictions.sqlRestriction("true")
							: Restrictions.or(Restrictions.eq("siswa.sekolah", sekolah),
									Restrictions.eq("calonSiswa.sekolah", sekolah)))

					.add(jurusan == null || jurusan.getId() == null ? Restrictions.sqlRestriction("true")
							: Restrictions.or(Restrictions.eq("mahasiswa.jurusan", jurusan),
									Restrictions.or(Restrictions.eq("biodataCalonMahasiswa.prodi1", jurusan),
											Restrictions.eq("biodataCalonMahasiswa.prodiLulus", jurusan))))

					.add(fakultas != null && fakultas.getId() != null && longsJurusans != null
							&& longsJurusans.isEmpty()
									? Restrictions.sqlRestriction("false")
									: longsJurusans == null || longsJurusans.isEmpty()
											? Restrictions.sqlRestriction("true")
											: Restrictions.or(Restrictions.in("mahasiswa.jurusan.id", longsJurusans),
													Restrictions.or(
															Restrictions.in("biodataCalonMahasiswa.prodi1.id",
																	longsJurusans),
															Restrictions.in("biodataCalonMahasiswa.prodiLulus.id",
																	longsJurusans))))

					.add(yayasan == null || yayasan.getId() == null ? Restrictions.sqlRestriction("true")
							: Restrictions.or(
									Restrictions.or(Restrictions.eq("siswa.yayasan", yayasan),
											Restrictions.eq("calonSiswa.yayasan", yayasan)),
									Restrictions.or(Restrictions.isNotNull("mahasiswa.id"),
											Restrictions.isNotNull("biodataCalonMahasiswa.id"))))

					.add(mhs.isEmpty() ? Restrictions.sqlRestriction("true")
							: Restrictions.or(
									Restrictions.or(
											Restrictions.ilike("calonSiswa.nomorInduk", mhs, MatchMode.ANYWHERE),
											Restrictions.ilike("calonSiswa.nama", mhs, MatchMode.ANYWHERE)),

									Restrictions.or(
											Restrictions.or(
													Restrictions.ilike("siswa.nomorInduk", mhs, MatchMode.ANYWHERE),
													Restrictions.ilike("siswa.nama", mhs, MatchMode.ANYWHERE)),

											Restrictions.or(Restrictions.or(
													Restrictions.ilike("mahasiswa.nim", mhs, MatchMode.ANYWHERE),
													Restrictions.ilike("mahasiswa.nama", mhs, MatchMode.ANYWHERE)),
													Restrictions.or(
															Restrictions.ilike("biodataCalonMahasiswa.nama", mhs,
																	MatchMode.ANYWHERE),
															Restrictions.or(
																	Restrictions.ilike(
																			"biodataCalonMahasiswa.noRegistrasi", mhs,
																			MatchMode.ANYWHERE),
																	Restrictions.ilike("biodataCalonMahasiswa.noUjian",
																			mhs, MatchMode.ANYWHERE)))))));
		}

		if (order)
			criteria.addOrder(Order.desc("id"));
		criteria

				.add((start == null || end == null || start.getValue() == null || end.getValue() == null) ? org.hibernate.criterion.Restrictions.sqlRestriction("1=1") : (searchDariTanggalBayar.isChecked()
						? Restrictions.sqlRestriction("date(this_.waktubayar) between date('"
								+ Common.databaseDateFormat.get().format(start.getValue()) + "') and date('"
								+ Common.databaseDateFormat.get().format(end.getValue()) + "')")
						: Restrictions.sqlRestriction("date(this_.tanggal_dirubah) between date('"
								+ Common.databaseDateFormat.get().format(start.getValue()) + "') and date('"
								+ Common.databaseDateFormat.get().format(end.getValue()) + "')")))

				.add(searchBelumKadaluarsa.isChecked()
						? Restrictions.sqlRestriction("date(this_.kadaluarsa) >= date('"
								+ Common.databaseDateFormat.get().format(WaktuUtil.getDate()) + "')")
						: Restrictions.sqlRestriction("true"))

				.add(searchTelahMembayar.isChecked()
						? Restrictions.or(Restrictions.or(Restrictions.isNotNull("pembayaran"), Restrictions.isNotNull("kegiatan")),
								Restrictions.isNotNull("deposit"))
						: Restrictions.sqlRestriction("true"))

				.add(searchBelumMembayar.isChecked()
						? Restrictions.and(Restrictions.and(Restrictions.isNull("pembayaran"), Restrictions.isNull("kegiatan")),
								Restrictions.isNull("deposit"))
						: Restrictions.sqlRestriction("true"))

				.add(searchKendala.isChecked() ? Restrictions.eq("terjadiKendala", true)
						: Restrictions.sqlRestriction("true"))

				.add(kode.getValue().trim().isEmpty() ? Restrictions.sqlRestriction("true")
						: Restrictions.or(Restrictions.ilike("nama", kode.getValue().trim()),
								Restrictions.ilike("kode", kode.getValue().trim())))

				.add(keterangan.getValue().trim().isEmpty() ? Restrictions.sqlRestriction("true")
						: Restrictions.or(
								Restrictions.ilike("keterangan", keterangan.getValue().trim(), MatchMode.ANYWHERE),
								Restrictions.ilike("notif", keterangan.getValue().trim(), MatchMode.ANYWHERE))

				)

				.add(bank.getValue().trim().isEmpty() ? Restrictions.sqlRestriction("true")
						: Restrictions.or(Restrictions.ilike("bank", bank.getValue().trim(), MatchMode.ANYWHERE),
								Restrictions.ilike("bankHost.nama", bank.getValue().trim(), MatchMode.ANYWHERE)));
		criteria.add(searchkode == null || searchkode.getValue().trim().isEmpty()
		        ? Restrictions.sqlRestriction("true")
		        : Restrictions.ilike("kode", searchkode.getValue().trim(), MatchMode.ANYWHERE));
		return criteria;
	}

	private Criterion userAccessRestriction() {
		if (tbmuser == null) {
			return Restrictions.sqlRestriction("true");
		}
		if (tbmuser.getMahasiswa() != null) {
			return Restrictions.eq("mahasiswa", tbmuser.getMahasiswa());
		}
		if (tbmuser.getSiswa() != null) {
			return Restrictions.eq("siswa", tbmuser.getSiswa());
		}
		if (tbmuser.getCalonSiswa() != null) {
			return Restrictions.eq("calonSiswa", tbmuser.getCalonSiswa());
		}
		return Restrictions.sqlRestriction("true");
	}

	public void onSearchDefault(Event event) {
		if (sedangMemuatData) {
			ulangiLoadSetelahSelesai = true;
			updateProgress("Menunggu proses sebelumnya", "Permintaan pencarian baru akan dijalankan setelah proses aktif selesai.", 25);
			return;
		}
		sedangMemuatData = true;
		ulangiLoadSetelahSelesai = false;
		updateProgress("Memuat virtual account", "Menyiapkan filter dan ringkasan dasbor.", 8);
		Common.createDefaultTimer(new EventListener() {
			@Override
			public void onEvent(Event arg0) throws Exception {
				onSearchDefaultTanpaProgress(arg0);
			}
		});
	}

	@SuppressWarnings("unchecked")
	private void onSearchDefaultTanpaProgress(Event event) {
		try {
			updateProgress("Menghitung data", "Menghitung total, status pembayaran, kendala, dan masa aktif VA.", 35);
			Common.initPaging(initCriteria(false), paging);

			updateProgress("Menyiapkan tabel", "Menyusun daftar virtual account sesuai halaman yang dibuka.", 65);
			List<VirtualAccountBank> virtualAccountBanka = initCriteria(true).setMaxResults(Common.ROWS_COUNT_ON_PAGE)
					.setFirstResult(Common.ROWS_COUNT_ON_PAGE * (paging == null ? 0 : paging.getActivePage())).list();

			ListModel strset = new SimpleListModel(virtualAccountBanka);
			grid.setRowRenderer(new VirtualAccountBankRenderer());
			grid.setModelCheckMobile(strset);

			updateProgress("Menyusun dasbor", "Membuat grafik, tren, dan spider kesiapan virtual account.", 88);
			renderDashboardVirtualAccount();
			finishProgress();
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
			finishProgress();
		} finally {
			sedangMemuatData = false;
			if (ulangiLoadSetelahSelesai) {
				ulangiLoadSetelahSelesai = false;
				Common.createDefaultTimer(new EventListener() {
					@Override
					public void onEvent(Event arg0) throws Exception {
						onSearchDefault(arg0);
					}
				});
			}
		}
	}

	private void renderDashboardVirtualAccount() {
		if (dashboardHtml == null) {
			return;
		}
		try {
			VirtualAccountDashboardUtil.Summary summary = buildDashboardSummary();
			dashboardHtml.setContent(VirtualAccountDashboardUtil.renderDashboard(summary));
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
			dashboardHtml.setContent("<div style='font-family:Arial,sans-serif;padding:12px;color:#991b1b;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;'>Dasbor belum bisa dimuat. Silakan cek kembali filter atau hubungi admin.</div>");
		}
	}


	private VirtualAccountDashboardUtil.Summary buildDashboardSummary() {
		Session session = null;
		FlushMode oldFlushMode = null;
		try {
			session = HibernateUtil.currentSession();
			oldFlushMode = session.getFlushMode();
			session.setFlushMode(FlushMode.MANUAL);
		} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:2444");
		}
		try {
			VirtualAccountDashboardUtil.Summary summary = new VirtualAccountDashboardUtil.Summary();
			summary.periode = Common.dateFormat.get().format(start.getValue()) + " s.d " + Common.dateFormat.get().format(end.getValue());
			summary.keteranganFilter = buildFilterDescription();
			summary.total = countData(null);
			summary.sudahBayar = countData(Restrictions.or(Restrictions.or(Restrictions.isNotNull("pembayaran"), Restrictions.isNotNull("kegiatan")),
					Restrictions.isNotNull("deposit")));
			summary.belumBayar = countData(Restrictions.and(Restrictions.and(Restrictions.isNull("pembayaran"), Restrictions.isNull("kegiatan")),
					Restrictions.isNull("deposit")));
			summary.kendala = countData(Restrictions.eq("terjadiKendala", true));
			summary.belumKadaluarsa = countData(Restrictions.sqlRestriction("date(this_.kadaluarsa) >= date('"
					+ Common.databaseDateFormat.get().format(WaktuUtil.getDate()) + "')"));
			summary.kadaluarsa = countData(Restrictions.sqlRestriction("date(this_.kadaluarsa) < date('"
					+ Common.databaseDateFormat.get().format(WaktuUtil.getDate()) + "')"));
			summary.totalNominal = sumData("total");
			summary.totalBiayaAdmin = sumData("biayaAdmin");
			summary.totalTopup = sumData("topup");
			summary.bankSummaries = loadBankSummaries();
			summary.trendSummaries = loadTrendSummaries();
			return summary;
		} finally {
			try {
				if (session != null && session.isOpen() && oldFlushMode != null) {
					session.setFlushMode(oldFlushMode);
				}
			} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/VirtualAccountBankAction.java:2471");
			}
		}
	}

	private String buildFilterDescription() {
		StringBuilder sb = new StringBuilder();
		appendFilterText(sb, "Nama/NIM", mahasiswa == null ? null : mahasiswa.getValue());
		appendFilterText(sb, "Kode", kode == null ? null : kode.getValue());
		appendFilterText(sb, "Bank", bank == null ? null : bank.getValue());
		appendFilterText(sb, "Jenis", jenis == null ? null : jenis.getValue());
		if (searchTelahMembayar != null && searchTelahMembayar.isChecked()) {
			appendFilterText(sb, "Status", "Telah Bayar");
		}
		if (searchBelumMembayar != null && searchBelumMembayar.isChecked()) {
			appendFilterText(sb, "Status", "Belum Bayar");
		}
		if (searchKendala != null && searchKendala.isChecked()) {
			appendFilterText(sb, "Kondisi", "Terjadi Kendala");
		}
		return sb.length() == 0 ? "Semua data sesuai periode" : sb.toString();
	}

	private void appendFilterText(StringBuilder sb, String label, String value) {
		if (value == null || value.trim().length() == 0) {
			return;
		}
		if (sb.length() > 0) {
			sb.append(" | ");
		}
		sb.append(label).append(": ").append(value.trim());
	}

	private int countData(Criterion extra) {
		try {
			Criteria c = initCriteria(false);
			if (extra != null) {
				c.add(extra);
			}
			Number n = (Number) c.setProjection(Projections.rowCount()).uniqueResult();
			return n == null ? 0 : n.intValue();
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
			return 0;
		}
	}

	private double sumData(String property) {
		try {
			Number n = (Number) initCriteria(false).setProjection(Projections.sum(property)).uniqueResult();
			return n == null ? 0.0 : n.doubleValue();
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
			return 0.0;
		}
	}

	@SuppressWarnings("rawtypes")
	private List<VirtualAccountDashboardUtil.BankSummary> loadBankSummaries() {
		List<VirtualAccountDashboardUtil.BankSummary> result = new ArrayList<VirtualAccountDashboardUtil.BankSummary>();
		try {
			Criteria c = initCriteria(false);
			c.setProjection(Projections.projectionList().add(Projections.groupProperty("bank"))
					.add(Projections.rowCount()).add(Projections.sum("total")));
			c.setMaxResults(8);
			List rows = c.list();
			for (Object rowObj : rows) {
				Object[] row = (Object[]) rowObj;
				String bankName = row[0] == null ? "Tanpa bank" : row[0].toString();
				int jumlah = row[1] == null ? 0 : ((Number) row[1]).intValue();
				double nominal = row[2] == null ? 0.0 : ((Number) row[2]).doubleValue();
				result.add(new VirtualAccountDashboardUtil.BankSummary(bankName, jumlah, nominal));
			}
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
		return result;
	}

	private List<VirtualAccountDashboardUtil.TrendSummary> loadTrendSummaries() {
		List<VirtualAccountDashboardUtil.TrendSummary> result = new ArrayList<VirtualAccountDashboardUtil.TrendSummary>();
		try {
			Calendar calendar = WaktuUtil.getCalendar();
			calendar.setTime(end.getValue());
			calendar.add(Calendar.DATE, -6);
			String kolomTanggal = searchDariTanggalBayar != null && searchDariTanggalBayar.isChecked()
					? "waktubayar" : "tanggal_dirubah";
			for (int i = 0; i < 7; i++) {
				Date tanggal = calendar.getTime();
				Criteria c = initCriteria(false);
				c.add(Restrictions.sqlRestriction("date(this_." + kolomTanggal + ") = date('"
						+ Common.databaseDateFormat.get().format(tanggal) + "')"));
				Number n = (Number) c.setProjection(Projections.rowCount()).uniqueResult();
				result.add(new VirtualAccountDashboardUtil.TrendSummary(Common.dateFormat8.get().format(tanggal),
						n == null ? 0 : n.intValue()));
				calendar.add(Calendar.DATE, 1);
			}
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
		return result;
	}

	private void updateProgress(String title, String detail, int percent) {
		if (progressHtml == null) {
			return;
		}
		try {
			progressHtml.setVisible(true);
			progressHtml.setContent(VirtualAccountDashboardUtil.renderProgress(title, detail, percent));
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
	}

	private void finishProgress() {
		updateProgress("Selesai", "Data virtual account sudah tampil 100%.", 100);
		Common.createDefaultTimer(new EventListener() {
			@Override
			public void onEvent(Event arg0) throws Exception {
				if (progressHtml != null) {
					progressHtml.setVisible(false);
				}
			}
		});
	}

}
