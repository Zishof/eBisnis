package ais.action.master.helper.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang.StringUtils;
import org.hibernate.criterion.Restrictions;
import org.zkoss.zk.ui.Component;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.util.GenericAutowireComposer;
import org.zkoss.zul.Borderlayout;
import org.zkoss.zul.Center;
import org.zkoss.zul.Columns;
import org.zkoss.zul.Group;
import org.zkoss.zul.Label;
import org.zkoss.zul.Radio;
import org.zkoss.zul.Radiogroup;
import org.zkoss.zul.Row;
import ais.ui.util.MyFormRow;
import org.zkoss.zul.Rows;
import org.zkoss.zul.South;
import org.zkoss.zul.Toolbar;

import ais.action.master.helper.virtualaccount.DownloadTagihanAnggotaKoperasiBankOnline;
import ais.action.master.helper.virtualaccount.DownloadTagihanSiswaBankOnline;
import ais.common.Common;
import ais.common.ConstantValues;
import ais.database.hibernate.HibernateUtil;
import ais.database.model.BankHost;
import ais.database.model.Konfigurasi;
import ais.database.model.VirtualAccountBank;
import ais.database.model.koperasi.AnggotaKoperasi;
import ais.database.model.koperasi.CaraPembayaranKoperasi;
import ais.database.model.koperasi.TransaksiKoperasiDetail;
import ais.database.model.sekolah.AkunPembayaranSiswa;
import ais.database.model.sekolah.CalonSiswa;
import ais.database.model.sekolah.KanalPembayaran;
import ais.database.model.sekolah.Sekolah;
import ais.database.model.sekolah.Siswa;
import ais.database.model.sekolah.Tagihan;
import ais.ui.util.MyButtonConfig;
import ais.ui.util.MyColumnConfig;
import ais.ui.util.MyGrid;
import ais.ui.util.MyIframe;
import ais.ui.util.MyLabelAgakKecil;
import ais.ui.util.MyLabelBold;
import ais.ui.util.MyLabelConfig;
import ais.ui.util.MyMessageboxConfig;
import ais.ui.util.MyRadioConfig;
import ais.ui.util.MyToolbarbuttonConfig;
import ais.ui.util.MyWindow;

public class SmartlinkChannelWindow extends GenericAutowireComposer {

	/**
	 * 
	 */
	private static final long serialVersionUID = -126126249643138234L;

	@Override
	public org.zkoss.zk.ui.metainfo.ComponentInfo doBeforeCompose(org.zkoss.zk.ui.Page page,
			org.zkoss.zk.ui.Component parent, org.zkoss.zk.ui.metainfo.ComponentInfo compInfo) {
		Common.doCheckSecurity();
		return super.doBeforeCompose(page, parent, compInfo);
	}

	@SuppressWarnings({ "rawtypes", "unchecked" })
	public void doAfterCompose(Component comp) throws Exception {
		// TODO Auto-generated method stub
		super.doAfterCompose(comp);

		Siswa siswa = (Siswa) (execution.getParameter("siswa") == null || execution.getParameter("siswa").equals("-1")
				? null
				: ConstantValues.ambil(Siswa.class.getName(), Long.parseLong(execution.getParameter("siswa"))));
		CalonSiswa calonSiswa = (CalonSiswa) (execution.getParameter("calonSiswa") == null
				|| execution.getParameter("calonSiswa").equals("-1") ? null
						: ConstantValues.ambil(CalonSiswa.class.getName(),
								Long.parseLong(execution.getParameter("calonSiswa"))));

		List<Long> idsTag = new ArrayList<Long>();
		for (String t : execution.getParameter("tag").split(",")) {
			try {
				idsTag.add(Long.parseLong(t.trim()));
			} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/helper/util/SmartlinkChannelWindow.java:88");
				// TODO: handle exception
			}
		}
		List<Tagihan> tag = HibernateUtil.currentSession().createCriteria(Tagihan.class)
				.add(idsTag.isEmpty() ? Restrictions.sqlRestriction("false") : Restrictions.in("id", idsTag)).list();
		Map param = new HashMap();
		param.put("esmartlink", true);
		Double biayaAdmin = 0.0;
		BankHost bankHost = (BankHost) (execution.getParameter("bankHost") == null
				|| execution.getParameter("bankHost").equals("-1") ? null
						: ConstantValues.ambil(BankHost.class.getName(),
								Long.parseLong(execution.getParameter("bankHost"))));
		AkunPembayaranSiswa akunPembayaranSiswa = (AkunPembayaranSiswa) (execution
				.getParameter("akunPembayaranSiswa") == null
				|| execution.getParameter("akunPembayaranSiswa").equals("-1") ? null
						: ConstantValues.ambil(AkunPembayaranSiswa.class.getName(),
								Long.parseLong(execution.getParameter("akunPembayaranSiswa"))));

		Double tabungan = (execution.getParameter("tabungan") == null
				|| execution.getParameter("tabungan").trim().equals("") ? null
						: Double.parseDouble(execution.getParameter("tabungan").trim()));

		Double topup = (execution.getParameter("topup") == null || execution.getParameter("topup").trim().equals("")
				? null
				: Double.parseDouble(execution.getParameter("topup").trim()));

		Sekolah sekolah = siswa != null ? siswa.getSekolah() : calonSiswa.getSekolah();

		String keterangan = "";
		Double total = 0.0;
		Map<Long, KanalPembayaran> kanalPembayarans = new HashMap<Long, KanalPembayaran>();
		for (Tagihan tagihan : tag) {

			if (tagihan.getNominalBiaya() != null && tagihan.getPengaturanBiaya() != null
					&& tagihan.getPengaturanBiaya().getJenisBiayaSekolah() != null
					&& tagihan.getPengaturanBiaya().getJenisBiayaSekolah()
							.getKanalPembayaran() != null) {
				kanalPembayarans.put(
						tagihan.getPengaturanBiaya().getJenisBiayaSekolah().getKanalPembayaran()
								.getId(),
						tagihan.getPengaturanBiaya().getJenisBiayaSekolah().getKanalPembayaran());
			} else if (tagihan.getSekolah() != null && tagihan.getSekolah().getKanalPembayaran() != null
					&& tagihan.getSekolah().getKanalPembayaran().getId() != null) {
				kanalPembayarans.put(tagihan.getSekolah().getKanalPembayaran().getId(),
						tagihan.getSekolah().getKanalPembayaran());
			} else {
				kanalPembayarans.put(-1L, null);
			}

			String desc = tagihan.getId() + "-" + tagihan.getItemBiayaSekolah().getNama()
					+ (tagihan.getNominalBiaya().getDibayarSebayak() > 1 ? " (ke " + tagihan.getBayarKe() + ")" : "")
					+ (tagihan.getBulan() == null ? "" : ", bulan " + tagihan.getBulan())
					+ (tagihan.getTahun() == null ? "" : ", tahun " + tagihan.getTahun()) + ", ";

			keterangan += desc;

			Double nilai = tagihan.getNominal() + tagihan.getDenda();
			total += (nilai - tagihan.getDiskon());
		}

		KanalPembayaran kanalPembayaran = null;
		if (kanalPembayarans.size() == 1 && !kanalPembayarans.containsKey(-1L)) {
			kanalPembayaran = kanalPembayarans.values().iterator().next();
		} else if (kanalPembayarans.size() > 1) {
			try {
				MyMessageboxConfig.show("Item biaya yang dipilih tidak boleh menggunakan kanal biaya yang berbeda",
						"Peringatan", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
			} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/helper/util/SmartlinkChannelWindow.java:156");
				// TODO: handle exception
			}
			return;
		}

		SmartlinkChannelWindow.init((MyWindow) page.getFirstRoot(), siswa, calonSiswa, tag, param, biayaAdmin, topup,
				tabungan, bankHost, akunPembayaranSiswa, sekolah, keterangan, total, false, kanalPembayaran);
	}

	/**
	 * Parse satu entri konfigurasi kanal e-smartlink "KODE:BIAYA:LABEL"
	 * menjadi {kode, biayaAdmin, label}. Entri yang tidak lengkap atau typo
	 * (label hilang, biaya bukan angka, segmen kosong karena ";;") menghasilkan
	 * null agar DILEWATI — bukan ArrayIndexOutOfBoundsException yang mematikan
	 * seluruh popup pembayaran. Label kosong di-fallback ke kode kanal.
	 */
	public static Object[] parseEntriKanal(String entri) {
		if (entri == null || entri.trim().isEmpty()) {
			return null;
		}
		String[] d = StringUtils.split(entri.trim(), ":");
		if (d == null || d.length < 2) {
			return null;
		}
		Double biayaAdmin;
		try {
			biayaAdmin = Double.parseDouble(d[1].trim());
		} catch (Exception e) {
			return null;
		}
		String label = d.length > 2 && !d[2].trim().isEmpty() ? d[2].trim() : d[0].trim();
		return new Object[] { d[0].trim(), biayaAdmin, label };
	}

	/**
	 * Isi radiogroup pilihan kanal dari string konfigurasi (dipakai juga oleh
	 * MahasiswaSmartlinkChannelWindow agar parsing & toleransi formatnya satu).
	 */
	public static void isiRadioKanal(Radiogroup radiogroup, String konfigurasiKanal, EventListener eventListener) {
		if (radiogroup == null || konfigurasiKanal == null) {
			return;
		}
		for (String s : konfigurasiKanal.split(";")) {
			Object[] entri = parseEntriKanal(s);
			if (entri == null) {
				continue;
			}
			Radio radio = new Radio(
					entri[2] + ", Biaya admin " + Common.numberFormat.get().format((Double) entri[1]));
			radio.setStyle("font-size:12px;");
			radio.setAttribute("biaya_admin", entri[1]);
			radio.setAttribute("channel", entri[0]);
			radiogroup.appendChild(radio);
			if (eventListener != null) {
				radio.addEventListener("onClick", eventListener);
			}
		}
	}

	public final static String WAKTU_15_MENIT = "paling lama 15 menit lagi";
	public final static String WAKTU_30_MENIT = "paling lama 30 menit lagi";
	public final static String WAKTU_1_JAM = "paling lama 1 jam lagi";
	public final static String WAKTU_3_JAM = "paling lama 3 jam lagi";
	public final static String WAKTU_6_JAM = "paling lama 6 jam lagi";
	public final static String WAKTU_24_JAM = "paling lama 24 jam lagi";
	public final static String WAKTU_3_HARI = "paling lama 3 hari lagi";
	public final static String WAKTU_1_MINGGU = "paling lama 1 minggu lagi";
	public final static String WAKTU_1_BULAN = "paling lama 1 bulan lagi";

	@SuppressWarnings({ "rawtypes", "deprecation" })
	public static void init(final MyWindow window, final Siswa siswa, final CalonSiswa calonSiswa,
			final Collection<Tagihan> tag, final Map param, final Double biayaAdmin, final Double tabungan,
			final Double topup, final BankHost bankHost, final AkunPembayaranSiswa akunPembayaranSiswa,
			final Sekolah sekolah, final String keterangan, final Double total, final boolean tampilBatal,
			final KanalPembayaran kanalPembayaran) {

		Borderlayout borderlayout = new ais.ui.util.MyBorderlayout();
		borderlayout.setParent(window);

		final Center center = new Center();
		center.setTitle("Proses Pembayaran Online");
		center.setParent(borderlayout);

		MyGrid grid = new MyGrid();
		grid.setWidth("100%");
		grid.setParent(center);
		grid.setHeight("100%");

		Columns columns = new Columns();
		columns.setParent(grid);
		MyColumnConfig column = new MyColumnConfig();
		column.setWidth("40%");
		column.setParent(columns);
		column = new MyColumnConfig();
		column.setParent(columns);

		Rows rows = new Rows();
		rows.setParent(grid);

		if (siswa != null) {
			MyFormRow row = new MyFormRow();
			row.setValign("top");
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("NIS Siswa"));
			row.appendChild(new MyLabelBold(siswa.getNomorInduk()));

			row = new MyFormRow();
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Nama Siswa"));
			row.appendChild(new MyLabelBold(siswa.getNama()));

			if (siswa.getPenjurusanSekolah() != null) {
				row = new MyFormRow();
				row.setParent(rows);
				row.appendChild(new ais.ui.util.MyLabelConfig("Penjurusan"));
				row.appendChild(new MyLabelBold(siswa.getPenjurusanSekolah().getNama()));
			}

		} else if (calonSiswa != null) {
			MyFormRow row = new MyFormRow();
			row.setValign("top");
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("No. Reg"));
			row.appendChild(new MyLabelBold(calonSiswa.getNoRegistrasi()));

			row = new MyFormRow();
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Nama Siswa"));
			row.appendChild(new MyLabelBold(calonSiswa.getNama()));

			if (calonSiswa.getPenjurusanSekolah() != null) {
				row = new MyFormRow();
				row.setParent(rows);
				row.appendChild(new ais.ui.util.MyLabelConfig("Penjurusan"));
				row.appendChild(new MyLabelBold(calonSiswa.getPenjurusanSekolah().getNama()));
			}
		}

		if (keterangan != null && !keterangan.trim().isEmpty()) {
			MyFormRow row = new MyFormRow();
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Tagihan"));
			row.appendChild(new MyLabelAgakKecil(keterangan));
		}

		if (tabungan != null && tabungan > 0.1) {
			MyFormRow row = new MyFormRow();
			row.setValign("top");
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Topup"));
			row.appendChild(new Label(Common.numberFormat.get().format(tabungan)));
		}

		MyFormRow row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new ais.ui.util.MyLabelConfig("Total Tagihan"));
		MyLabelBold aaa;
		row.appendChild(aaa = new MyLabelBold(Common.numberFormat.get().format(total)));
		aaa.setStyle("font-size:16px;font-weight: bolder;");

		Group group = new Group("Pilih Channel Pembayaran");
		group.setParent(rows);

		row = new MyFormRow();
		ais.ui.util.ZkCompat.setSpans(row, "2");
		row.setParent(rows);

		final MyLabelBold totalPembayaran = new MyLabelBold();
		final Radiogroup radiogroup = new Radiogroup();

		final Double mytotal = total;

		EventListener eventListener = new EventListener() {

			@Override
			public void onEvent(Event arg0) throws Exception {

				Radio selected = radiogroup.getSelectedItem();

				if (selected != null) {
					Double biaya_admin = (Double) selected.getAttribute("biaya_admin");

					totalPembayaran.setValue(Common.numberFormat.get().format(mytotal + biaya_admin));
				}

			}
		};

		radiogroup.setOrient("vertical");
		row.appendChild(radiogroup);

		String chanel = kanalPembayaran == null || kanalPembayaran.getVariableBiayaAdminEsmartlink() == null
				? sekolah.getVariableBiayaAdminEsmartlink()
				: kanalPembayaran.getVariableBiayaAdminEsmartlink();

		isiRadioKanal(radiogroup, chanel, eventListener);

		row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new MyLabelConfig("Total Bayar"));
		row.appendChild(totalPembayaran);
		totalPembayaran.setStyle("font-size:16px;font-weight: bolder;");

		boolean ditampilkanDefaultBayarWaktu = Common
				.getKonfigurasi("jangka_waktu_default_ditampilkan", Konfigurasi.AKTIF).getNilai().trim()
				.equalsIgnoreCase(Konfigurasi.AKTIF);
		String defaultBayarWaktu = Common.getKonfigurasi("jangka_waktu_default", "").getNilai().trim();

		group = new Group("Saya akan membayar tagihan ini dalam jangka waktu :");
		group.setParent(rows);

		row = new MyFormRow();
		row.setVisible(!ditampilkanDefaultBayarWaktu && !defaultBayarWaktu.isEmpty());
		ais.ui.util.ZkCompat.setSpans(row, "2");
		row.setParent(rows);
		row.appendChild(new MyLabelBold(defaultBayarWaktu));

		row = new MyFormRow();
		row.setVisible(ditampilkanDefaultBayarWaktu);
		ais.ui.util.ZkCompat.setSpans(row, "2");
		row.setParent(rows);

		final Radiogroup waktuBayarDalam;
		row.appendChild(waktuBayarDalam = new Radiogroup());
		waktuBayarDalam.setOrient("vertical");
		Radio radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_15_MENIT);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_15_MENIT);
		radio.setValue(SmartlinkChannelWindow.WAKTU_15_MENIT);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_30_MENIT);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_30_MENIT);
		radio.setValue(SmartlinkChannelWindow.WAKTU_30_MENIT);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_1_JAM);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_1_JAM);
		radio.setValue(SmartlinkChannelWindow.WAKTU_1_JAM);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_3_JAM);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_3_JAM);
		radio.setValue(SmartlinkChannelWindow.WAKTU_3_JAM);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_6_JAM);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_6_JAM);
		radio.setValue(SmartlinkChannelWindow.WAKTU_6_JAM);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_24_JAM);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_24_JAM);
		radio.setValue(SmartlinkChannelWindow.WAKTU_24_JAM);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_3_HARI);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_3_HARI);
		radio.setValue(SmartlinkChannelWindow.WAKTU_3_HARI);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_1_MINGGU);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_1_MINGGU);
		radio.setValue(SmartlinkChannelWindow.WAKTU_1_MINGGU);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);
		radio = new MyRadioConfig(SmartlinkChannelWindow.WAKTU_1_BULAN);
		radio.setAttribute("value", SmartlinkChannelWindow.WAKTU_1_BULAN);
		radio.setValue(SmartlinkChannelWindow.WAKTU_1_BULAN);
		radio.setStyle("font-size:12px;");
		waktuBayarDalam.appendChild(radio);

		if (!defaultBayarWaktu.isEmpty()) {
			Common.selectRadioItem(waktuBayarDalam, defaultBayarWaktu);
		}

		if (tampilBatal) {

			South south = new South();
			ais.ui.util.ZkCompat.setFlex(south, true);
			south.setParent(borderlayout);

			Toolbar toolbar = new Toolbar();
			toolbar.setParent(south);

			MyToolbarbuttonConfig cancel = new MyToolbarbuttonConfig("Batal", "/img/cancel.gif");
			cancel.setStyle("font-size:20px;font-weight: bolder;");
			cancel.setTooltiptext("Tutup");
			cancel.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {
					window.detach();
				}
			});
			cancel.setParent(toolbar);

			MyToolbarbuttonConfig save = new MyToolbarbuttonConfig("Proses Bayar", "/img/save.gif");
			save.setAttribute("janganDisabled", true);
			save.setStyle("font-size:20px;font-weight: bolder;");
			save.setTooltiptext("Proses");
			save.setParent(toolbar);
			save.addEventListener("onClick", new EventListener() {
				@SuppressWarnings("unchecked")
				@Override
				public void onEvent(Event event) throws Exception {

					Radio selected = radiogroup.getSelectedItem();

					if (selected != null) {
						Double biaya_admin = (Double) selected.getAttribute("biaya_admin");
						String channel = (String) selected.getAttribute("channel");
						param.put("esmartlinkBayarVia", channel);
						param.put("update", true);

						String val = waktuBayarDalam.getSelectedItem() == null ? null
								: (String) waktuBayarDalam.getSelectedItem().getValue();
						if (val != null) {

							List<String> warnings = new ArrayList<String>();

							VirtualAccountBank virtualAccountBank = DownloadTagihanSiswaBankOnline.downloadData(siswa,
									calonSiswa, tag, param, biaya_admin, topup, tabungan, bankHost, akunPembayaranSiswa,
									sekolah, warnings, val);
							if (virtualAccountBank != null && !virtualAccountBank.getLink().isEmpty()) {
								window.detach();
								Common.displayWindowIframe(virtualAccountBank.getLink(), true, "600px", "95%",
										"Pembayaran Online");
							} else {
								MyMessageboxConfig.show(
										"Transaksi gagal dilakukan"
												+ (warnings.isEmpty() ? "" : "\n\n" + warnings.toString()),
										"Peringatan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
							}
						} else {
							MyMessageboxConfig.show("Pilihlah batas waktu paling lambat Anda akan melakukan pembayaran",
									"Peringatan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
						}
					} else {
						MyMessageboxConfig.show("Pilih salah satu channel pembayaran", "Peringatan",
								MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					}

				}
			});
		} else {
			MyFormRow rowPilih = new MyFormRow();
			ais.ui.util.ZkCompat.setSpans(rowPilih, "2");
			rowPilih.setParent(rows);

			MyButtonConfig save = new MyButtonConfig("Proses Bayar", "/img/save.gif");
			save.setAttribute("janganDisabled", true);
			save.setStyle("font-size:20px;font-weight: bolder;");
			save.setTooltiptext("Proses");
			save.setParent(rowPilih);
			save.addEventListener("onClick", new EventListener() {
				@SuppressWarnings("unchecked")
				@Override
				public void onEvent(Event event) throws Exception {

					Radio selected = radiogroup.getSelectedItem();

					if (selected != null) {
						Double biaya_admin = (Double) selected.getAttribute("biaya_admin");
						String channel = (String) selected.getAttribute("channel");
						param.put("esmartlinkBayarVia", channel);
						param.put("update", true);

						String val = waktuBayarDalam.getSelectedItem() == null ? null
								: (String) waktuBayarDalam.getSelectedItem().getValue();
						if (val != null) {

							List<String> warnings = new ArrayList<String>();

							VirtualAccountBank virtualAccountBank = DownloadTagihanSiswaBankOnline.downloadData(siswa,
									calonSiswa, tag, param, biaya_admin, tabungan, topup, bankHost, akunPembayaranSiswa,
									sekolah, warnings, val);
							if (virtualAccountBank != null && !virtualAccountBank.getLink().isEmpty()) {

								Common.clear(center);

								MyIframe myIframe = new MyIframe(virtualAccountBank.getLink());
								myIframe.setScrolling("yes");
								myIframe.setWidth("100%");
								myIframe.setHeight("100%");
								myIframe.setStyle("height:100%;width:100%");
								center.appendChild(myIframe);

							} else {
								MyMessageboxConfig.show("Transaksi gagal dilakukan", "Peringatan",
										MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
							}
						} else {
							MyMessageboxConfig.show("Pilihlah batas waktu paling lambat Anda akan melakukan pembayaran",
									"Peringatan", MyMessageboxConfig.OK, MyMessageboxConfig.EXCLAMATION);
						}
					} else {
						MyMessageboxConfig.show("Pilih salah satu channel pembayaran", "Peringatan",
								MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					}

				}
			});
		}

	}

	@SuppressWarnings({ "rawtypes", "deprecation" })
	public static void init(final MyWindow window, final AnggotaKoperasi anggotaKoperasi,
			final Collection<TransaksiKoperasiDetail> tag, final Map param, final Double biayaAdmin,
			final BankHost bankHost, final CaraPembayaranKoperasi caraPembayaranKoperasi, final String keterangan,
			final Double total, final boolean tampilBatal, final KanalPembayaran kanalPembayaran) {

		Borderlayout borderlayout = new ais.ui.util.MyBorderlayout();
		borderlayout.setParent(window);

		final Center center = new Center();
		center.setTitle("Proses Pembayaran Online");
		center.setParent(borderlayout);

		MyGrid grid = new MyGrid();
		grid.setWidth("100%");
		grid.setParent(center);
		grid.setHeight("100%");

		Columns columns = new Columns();
		columns.setParent(grid);
		MyColumnConfig column = new MyColumnConfig();
		column.setWidth("40%");
		column.setParent(columns);
		column = new MyColumnConfig();
		column.setParent(columns);

		Rows rows = new Rows();
		rows.setParent(grid);

		if (anggotaKoperasi != null) {
			MyFormRow row = new MyFormRow();
			row.setValign("top");
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Kode Anggota"));
			row.appendChild(new MyLabelBold(anggotaKoperasi.getKode()));

			row = new MyFormRow();
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Nama Siswa"));
			row.appendChild(new MyLabelBold(anggotaKoperasi.getNama()));

		}

		MyFormRow row = new MyFormRow();
		row.setValign("top");
		row.setParent(rows);
		row.appendChild(new ais.ui.util.MyLabelConfig("Koperasi"));
		row.appendChild(new MyLabelBold(anggotaKoperasi.getKoperasi().getNama()));

		row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new ais.ui.util.MyLabelConfig("Tagihan"));
		row.appendChild(new Label(keterangan));

		row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new ais.ui.util.MyLabelConfig("Total Tagihan"));
		MyLabelBold aaa;
		row.appendChild(aaa = new MyLabelBold(Common.numberFormat.get().format(total)));
		aaa.setStyle("font-size:16px;font-weight: bolder;");

		Group group = new Group("Pilih Channel Pembayaran");
		group.setParent(rows);

		row = new MyFormRow();
		ais.ui.util.ZkCompat.setSpans(row, "2");
		row.setParent(rows);

		final MyLabelBold totalPembayaran = new MyLabelBold();
		final Radiogroup radiogroup = new Radiogroup();

		final Double mytotal = total;

		EventListener eventListener = new EventListener() {

			@Override
			public void onEvent(Event arg0) throws Exception {

				Radio selected = radiogroup.getSelectedItem();

				if (selected != null) {
					Double biaya_admin = (Double) selected.getAttribute("biaya_admin");

					totalPembayaran.setValue(Common.numberFormat.get().format(mytotal + biaya_admin));
				}

			}
		};

		radiogroup.setOrient("vertical");
		row.appendChild(radiogroup);

		String chanel = kanalPembayaran.getVariableBiayaAdminEsmartlink();

		for (String s : chanel.split(";")) {
			String[] d = StringUtils.split(s.trim(), ":");

			Radio radio = new Radio(d[2] + ", Biaya admin " + Common.numberFormat.get().format(Double.parseDouble(d[1])));
			radio.setStyle("font-size:12px;");
			radio.setAttribute("biaya_admin", Double.parseDouble(d[1]));
			radio.setAttribute("channel", d[0]);
			radiogroup.appendChild(radio);

			radio.addEventListener("onClick", eventListener);
		}

		row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new MyLabelConfig("Total Bayar"));
		row.appendChild(totalPembayaran);
		totalPembayaran.setStyle("font-size:16px;font-weight: bolder;");

		if (tampilBatal) {

			South south = new South();
			ais.ui.util.ZkCompat.setFlex(south, true);
			south.setParent(borderlayout);

			Toolbar toolbar = new Toolbar();
			toolbar.setParent(south);

			MyToolbarbuttonConfig cancel = new MyToolbarbuttonConfig("Batal", "/img/cancel.gif");
			cancel.setStyle("font-size:20px;font-weight: bolder;");
			cancel.setTooltiptext("Tutup");
			cancel.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {
					window.detach();
				}
			});
			cancel.setParent(toolbar);

			MyToolbarbuttonConfig save = new MyToolbarbuttonConfig("Proses Bayar", "/img/save.gif");
			save.setStyle("font-size:20px;font-weight: bolder;");
			save.setTooltiptext("Proses");
			save.setParent(toolbar);
			save.addEventListener("onClick", new EventListener() {
				@SuppressWarnings("unchecked")
				@Override
				public void onEvent(Event event) throws Exception {

					Radio selected = radiogroup.getSelectedItem();

					if (selected != null) {
						Double biaya_admin = (Double) selected.getAttribute("biaya_admin");
						String channel = (String) selected.getAttribute("channel");
						param.put("esmartlinkBayarVia", channel);
						param.put("update", true);
						VirtualAccountBank virtualAccountBank = DownloadTagihanAnggotaKoperasiBankOnline.downloadData(
								anggotaKoperasi, tag, param, biaya_admin, bankHost, caraPembayaranKoperasi);
						if (virtualAccountBank != null && !virtualAccountBank.getLink().isEmpty()) {
							window.detach();
							Common.displayWindowIframe(virtualAccountBank.getLink(), true, "600px", "95%",
									"Pembayaran Online");
						} else {
							MyMessageboxConfig.show("Transaksi gagal dilakukan", "Peringatan", MyMessageboxConfig.OK,
									MyMessageboxConfig.EXCLAMATION);
						}
					} else {
						MyMessageboxConfig.show("Pilih salah satu channel pembayaran", "Peringatan",
								MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					}

				}
			});
		} else {
			MyFormRow rowPilih = new MyFormRow();
			ais.ui.util.ZkCompat.setSpans(rowPilih, "2");
			rowPilih.setParent(rows);

			MyButtonConfig save = new MyButtonConfig("Proses Bayar", "/img/save.gif");
			save.setStyle("font-size:20px;font-weight: bolder;");
			save.setTooltiptext("Proses");
			save.setParent(rowPilih);
			save.addEventListener("onClick", new EventListener() {
				@SuppressWarnings("unchecked")
				@Override
				public void onEvent(Event event) throws Exception {

					Radio selected = radiogroup.getSelectedItem();

					if (selected != null) {
						Double biaya_admin = (Double) selected.getAttribute("biaya_admin");
						String channel = (String) selected.getAttribute("channel");
						param.put("esmartlinkBayarVia", channel);
						param.put("update", true);
						VirtualAccountBank virtualAccountBank = DownloadTagihanAnggotaKoperasiBankOnline.downloadData(
								anggotaKoperasi, tag, param, biaya_admin, bankHost, caraPembayaranKoperasi);
						if (virtualAccountBank != null && !virtualAccountBank.getLink().isEmpty()) {

							Common.clear(center);

							MyIframe myIframe = new MyIframe(virtualAccountBank.getLink());
							myIframe.setScrolling("yes");
							myIframe.setWidth("100%");
							myIframe.setHeight("100%");
							myIframe.setStyle("height:100%;width:100%");
							center.appendChild(myIframe);

						} else {
							MyMessageboxConfig.show("Transaksi gagal dilakukan", "Peringatan", MyMessageboxConfig.OK,
									MyMessageboxConfig.EXCLAMATION);
						}
					} else {
						MyMessageboxConfig.show("Pilih salah satu channel pembayaran", "Peringatan",
								MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					}

				}
			});
		}

	}

	@SuppressWarnings({ "rawtypes", "deprecation" })
	public static void init(final MyWindow window, final AnggotaKoperasi anggotaKoperasi, final Map param,
			final Double biayaAdmin, final BankHost bankHost, final CaraPembayaranKoperasi caraPembayaranKoperasi,
			final String keterangan, final Double total, final boolean tampilBatal,
			final KanalPembayaran kanalPembayaran) {

		Borderlayout borderlayout = new ais.ui.util.MyBorderlayout();
		borderlayout.setParent(window);

		final Center center = new Center();
		center.setTitle("Proses Pembayaran Online");
		center.setParent(borderlayout);

		MyGrid grid = new MyGrid();
		grid.setWidth("100%");
		grid.setParent(center);
		grid.setHeight("100%");

		Columns columns = new Columns();
		columns.setParent(grid);
		MyColumnConfig column = new MyColumnConfig();
		column.setWidth("40%");
		column.setParent(columns);
		column = new MyColumnConfig();
		column.setParent(columns);

		Rows rows = new Rows();
		rows.setParent(grid);

		if (anggotaKoperasi != null) {
			MyFormRow row = new MyFormRow();
			row.setValign("top");
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Kode Anggota"));
			row.appendChild(new MyLabelBold(anggotaKoperasi.getKode()));

			row = new MyFormRow();
			row.setParent(rows);
			row.appendChild(new ais.ui.util.MyLabelConfig("Nama Siswa"));
			row.appendChild(new MyLabelBold(anggotaKoperasi.getNama()));

		}

		MyFormRow row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new ais.ui.util.MyLabelConfig("Tagihan"));
		row.appendChild(new Label(keterangan));

		row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new ais.ui.util.MyLabelConfig("Total Tagihan"));
		MyLabelBold aaa;
		row.appendChild(aaa = new MyLabelBold(Common.numberFormat.get().format(total)));
		aaa.setStyle("font-size:16px;font-weight: bolder;");

		Group group = new Group("Pilih Channel Pembayaran");
		group.setParent(rows);

		row = new MyFormRow();
		ais.ui.util.ZkCompat.setSpans(row, "2");
		row.setParent(rows);

		final MyLabelBold totalPembayaran = new MyLabelBold();
		final Radiogroup radiogroup = new Radiogroup();

		final Double mytotal = total;

		EventListener eventListener = new EventListener() {

			@Override
			public void onEvent(Event arg0) throws Exception {

				Radio selected = radiogroup.getSelectedItem();

				if (selected != null) {
					Double biaya_admin = (Double) selected.getAttribute("biaya_admin");

					totalPembayaran.setValue(Common.numberFormat.get().format(mytotal + biaya_admin));
				}

			}
		};

		radiogroup.setOrient("vertical");
		row.appendChild(radiogroup);

		String chanel = kanalPembayaran.getVariableBiayaAdminEsmartlink();

		for (String s : chanel.split(";")) {
			String[] d = StringUtils.split(s.trim(), ":");

			Radio radio = new Radio(d[2] + ", Biaya admin " + Common.numberFormat.get().format(Double.parseDouble(d[1])));
			radio.setStyle("font-size:12px;");
			radio.setAttribute("biaya_admin", Double.parseDouble(d[1]));
			radio.setAttribute("channel", d[0]);
			radiogroup.appendChild(radio);

			radio.addEventListener("onClick", eventListener);
		}

		row = new MyFormRow();
		row.setParent(rows);
		row.appendChild(new MyLabelConfig("Total Bayar"));
		row.appendChild(totalPembayaran);
		totalPembayaran.setStyle("font-size:16px;font-weight: bolder;");

		if (tampilBatal) {

			South south = new South();
			ais.ui.util.ZkCompat.setFlex(south, true);
			south.setParent(borderlayout);

			Toolbar toolbar = new Toolbar();
			toolbar.setParent(south);

			MyToolbarbuttonConfig cancel = new MyToolbarbuttonConfig("Batal", "/img/cancel.gif");
			cancel.setStyle("font-size:20px;font-weight: bolder;");
			cancel.setTooltiptext("Tutup");
			cancel.addEventListener("onClick", new EventListener() {
				@Override
				public void onEvent(Event event) throws Exception {
					window.detach();
				}
			});
			cancel.setParent(toolbar);

			MyToolbarbuttonConfig save = new MyToolbarbuttonConfig("Proses Bayar", "/img/save.gif");
			save.setStyle("font-size:20px;font-weight: bolder;");
			save.setTooltiptext("Proses");
			save.setParent(toolbar);
			save.addEventListener("onClick", new EventListener() {
				@SuppressWarnings("unchecked")
				@Override
				public void onEvent(Event event) throws Exception {

					Radio selected = radiogroup.getSelectedItem();

					if (selected != null) {
						Double biaya_admin = (Double) selected.getAttribute("biaya_admin");
						String channel = (String) selected.getAttribute("channel");
						param.put("esmartlinkBayarVia", channel);
						param.put("update", true);
						VirtualAccountBank virtualAccountBank = DownloadTagihanAnggotaKoperasiBankOnline.downloadData(
								anggotaKoperasi, total, biaya_admin, param, bankHost, caraPembayaranKoperasi);
						if (virtualAccountBank != null && !virtualAccountBank.getLink().isEmpty()) {
							window.detach();
							Common.displayWindowIframe(virtualAccountBank.getLink(), true, "600px", "95%",
									"Pembayaran Online");
						} else {
							MyMessageboxConfig.show("Transaksi gagal dilakukan", "Peringatan", MyMessageboxConfig.OK,
									MyMessageboxConfig.EXCLAMATION);
						}
					} else {
						MyMessageboxConfig.show("Pilih salah satu channel pembayaran", "Peringatan",
								MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					}

				}
			});
		} else {
			MyFormRow rowPilih = new MyFormRow();
			ais.ui.util.ZkCompat.setSpans(rowPilih, "2");
			rowPilih.setParent(rows);

			MyButtonConfig save = new MyButtonConfig("Proses Bayar", "/img/save.gif");
			save.setStyle("font-size:20px;font-weight: bolder;");
			save.setTooltiptext("Proses");
			save.setParent(rowPilih);
			save.addEventListener("onClick", new EventListener() {
				@SuppressWarnings("unchecked")
				@Override
				public void onEvent(Event event) throws Exception {

					Radio selected = radiogroup.getSelectedItem();

					if (selected != null) {
						Double biaya_admin = (Double) selected.getAttribute("biaya_admin");
						String channel = (String) selected.getAttribute("channel");
						param.put("esmartlinkBayarVia", channel);
						param.put("update", true);
						VirtualAccountBank virtualAccountBank = DownloadTagihanAnggotaKoperasiBankOnline.downloadData(
								anggotaKoperasi, total, biaya_admin, param, bankHost, caraPembayaranKoperasi);
						if (virtualAccountBank != null && !virtualAccountBank.getLink().isEmpty()) {

							Common.clear(center);

							MyIframe myIframe = new MyIframe(virtualAccountBank.getLink());
							myIframe.setScrolling("yes");
							myIframe.setWidth("100%");
							myIframe.setHeight("100%");
							myIframe.setStyle("height:100%;width:100%");
							center.appendChild(myIframe);

						} else {
							MyMessageboxConfig.show("Transaksi gagal dilakukan", "Peringatan", MyMessageboxConfig.OK,
									MyMessageboxConfig.EXCLAMATION);
						}
					} else {
						MyMessageboxConfig.show("Pilih salah satu channel pembayaran", "Peringatan",
								MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
					}

				}
			});
		}

	}
}
