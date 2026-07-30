package ais.action.master.helper.virtualaccount;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.codec.digest.DigestUtils;
import org.hibernate.Session;
import org.hibernate.criterion.Order;
import org.hibernate.criterion.Restrictions;
import org.json.JSONArray;
import org.json.JSONObject;
import org.zkoss.zk.ui.sys.ExecutionsCtrl;

import ais.action.master.helper.util.PerguruanTinggiUtil;
import ais.action.master.helper.util.SmartlinkChannelWindow;
import ais.common.BJBUtil;
import ais.common.BSIMajaUtil;
import ais.common.Common;
import ais.common.URLBuilder;
import ais.database.hibernate.HibernateUtil;
import ais.database.model.BankHost;
import ais.database.model.Konfigurasi;
import ais.database.model.VirtualAccountBank;
import ais.database.model.sekolah.AkunPembayaranSiswa;
import ais.database.model.sekolah.CalonSiswa;
import ais.database.model.sekolah.KanalPembayaran;
import ais.database.model.sekolah.Sekolah;
import ais.database.model.sekolah.Siswa;
import ais.database.model.sekolah.Tagihan;
import ais.ui.util.MyMessageboxConfig;
import ais.ui.util.MyWindow;
import ais.ui.util.WaktuUtil;

public class DownloadTagihanSiswaBankOnline {

	public static final String getBasicAuthenticationHeader(String username, String password) {
		String valueToEncode = username + ":" + password;
		return "Basic " + new String(org.apache.commons.codec.binary.Base64.encodeBase64(valueToEncode.getBytes()));
	}

	@SuppressWarnings({ "rawtypes" })
	public static VirtualAccountBank downloadData(Siswa siswa, CalonSiswa calonSiswa, Collection<Tagihan> tag,
			Map param, Double biayaAdmin, BankHost bankHost, AkunPembayaranSiswa akunPembayaranSiswa, Sekolah sekolah)
			throws Exception {
		Double topup = null;
		Double tabungan = null;
		return downloadData(siswa, calonSiswa, tag, param, biayaAdmin, tabungan, topup, bankHost, akunPembayaranSiswa,
				sekolah, null, null);
	}

	@SuppressWarnings({ "rawtypes" })
	public static VirtualAccountBank downloadData(Siswa siswa, CalonSiswa calonSiswa, Collection<Tagihan> tag,
			Map param, Double biayaAdmin, Double tabungan, BankHost bankHost, AkunPembayaranSiswa akunPembayaranSiswa,
			Sekolah sekolah) throws Exception {
		Double topup = null;
		return downloadData(siswa, calonSiswa, tag, param, biayaAdmin, tabungan, topup, bankHost, akunPembayaranSiswa,
				sekolah, null, null);
	}

	@SuppressWarnings({ "rawtypes" })
	public static VirtualAccountBank downloadData(Siswa siswa, CalonSiswa calonSiswa, Collection<Tagihan> tag,
			Map param, Double biayaAdmin, Double tabungan, BankHost bankHost, AkunPembayaranSiswa akunPembayaranSiswa,
			Sekolah sekolah, List<String> warnings) throws Exception {
		Double topup = null;
		return downloadData(siswa, calonSiswa, tag, param, biayaAdmin, tabungan, topup, bankHost, akunPembayaranSiswa,
				sekolah, warnings, null);
	}

	@SuppressWarnings({ "rawtypes" })
	public static VirtualAccountBank downloadData(Siswa siswa, CalonSiswa calonSiswa, Collection<Tagihan> tag,
			Map param, Double biayaAdmin, Double tabungan, Double topup, BankHost bankHost,
			AkunPembayaranSiswa akunPembayaranSiswa, Sekolah sekolah) throws Exception {
		return downloadData(siswa, calonSiswa, tag, param, biayaAdmin, tabungan, topup, bankHost, akunPembayaranSiswa,
				sekolah, null, null);
	}

	@SuppressWarnings({ "rawtypes" })
	public static VirtualAccountBank downloadData(Siswa siswa, CalonSiswa calonSiswa, Collection<Tagihan> tag,
			Map param, Double biayaAdmin, Double tabungan, Double topup, BankHost bankHost,
			AkunPembayaranSiswa akunPembayaranSiswa, Sekolah sekolah, List<String> warnings) throws Exception {
		return downloadData(siswa, calonSiswa, tag, param, biayaAdmin, tabungan, topup, bankHost, akunPembayaranSiswa,
				sekolah, warnings, null);
	}

	@SuppressWarnings({ "rawtypes" })
	public static VirtualAccountBank downloadData(Siswa siswa, CalonSiswa calonSiswa, Collection<Tagihan> tag,
			Map param, Double biayaAdmin, Double tabungan, Double topup, BankHost bankHost,
			AkunPembayaranSiswa akunPembayaranSiswa, Sekolah sekolah, List<String> warnings, String waktuSampai)
			throws Exception {

		Session session = null;

		try {
			boolean qris = param.get("qris") != null && (Boolean) param.get("qris");
			boolean flip = param.get("flip") != null && (Boolean) param.get("flip");
			boolean esmartlink = param.get("esmartlink") != null && (Boolean) param.get("esmartlink");
			String esmartlinkBayarVia = param.get("esmartlinkBayarVia") != null
					? (String) param.get("esmartlinkBayarVia")
					: null;
			boolean finpay = param.get("finpay") != null && (Boolean) param.get("finpay");
			boolean maja = param.get("maja") != null && (Boolean) param.get("maja");
			boolean update = param.get("update") != null && (Boolean) param.get("update");
			boolean bjb_langsung = param.get("bjb_langsung") != null && (Boolean) param.get("bjb_langsung");

			String cicilan = "";
			Double total = 0.0;
			JSONArray items = new JSONArray();

			if (biayaAdmin != null && biayaAdmin > 0) {
				JSONObject jsonObjectitems = new JSONObject();
				jsonObjectitems.put("description", "Biaya Admin");
				jsonObjectitems.put("unitPrice", biayaAdmin.intValue());
				jsonObjectitems.put("qty", 1);
				jsonObjectitems.put("amount", biayaAdmin.intValue());
				items.put(jsonObjectitems);
			}

			if (tabungan != null && tabungan > 0.1) {
				JSONObject jsonObjectitems = new JSONObject();
				jsonObjectitems.put("description", "Pengurangan karena mengambil dari tabungan");
				jsonObjectitems.put("unitPrice", -tabungan.intValue());
				jsonObjectitems.put("qty", 1);
				jsonObjectitems.put("amount", -tabungan.intValue());
				items.put(jsonObjectitems);
			}

			StringBuilder keteranganBuilder = new StringBuilder();
			StringBuilder keteranganSimpleBuilder = new StringBuilder();
			StringBuilder keteranganSimpleBangetBuilder = new StringBuilder();

			KanalPembayaran kanalPembayaran = null;
			List<Tagihan> tagihans = null;
			Map<Long, KanalPembayaran> kanalPembayarans = new HashMap<Long, KanalPembayaran>();

			if (tag != null) {
				tagihans = new ArrayList<Tagihan>(tag);
				Collections.sort(tagihans);

				for (Tagihan tagihan : tagihans) {
					if (tagihan.getNominalBiaya() != null && tagihan.getPengaturanBiaya() != null
							&& tagihan.getPengaturanBiaya().getJenisBiayaSekolah() != null
							&& tagihan.getPengaturanBiaya().getJenisBiayaSekolah()
									.getKanalPembayaran() != null) {
						kanalPembayarans.put(
								tagihan.getPengaturanBiaya().getJenisBiayaSekolah()
										.getKanalPembayaran().getId(),
								tagihan.getPengaturanBiaya().getJenisBiayaSekolah()
										.getKanalPembayaran());
					} else if (tagihan.getSekolah() != null && tagihan.getSekolah().getKanalPembayaran() != null
							&& tagihan.getSekolah().getKanalPembayaran().getId() != null) {
						kanalPembayarans.put(tagihan.getSekolah().getKanalPembayaran().getId(),
								tagihan.getSekolah().getKanalPembayaran());
					} else {
						kanalPembayarans.put(-1L, null);
					}

					String commonDesc = tagihan.getItemBiayaSekolah().getNama()
							+ (tagihan.getNominalBiaya().getDibayarSebayak() > 1 ? " (ke " + tagihan.getBayarKe() + ")"
									: "")
							+ (tagihan.getBulan() == null ? "" : ", bulan " + tagihan.getBulan())
							+ (tagihan.getTahun() == null ? "" : ", tahun " + tagihan.getTahun()) + ", ";

					keteranganBuilder.append(tagihan.getId()).append("-").append(commonDesc);
					keteranganSimpleBuilder.append(commonDesc);

					if (keteranganSimpleBangetBuilder.length() > 0) {
						keteranganSimpleBangetBuilder.append(";");
					}
					keteranganSimpleBangetBuilder.append(tagihan.getId());

					Double nilai = (tagihan.getNominal() + tagihan.getDenda()) - tagihan.getDiskon();
					total += nilai;

					cicilan = MahasiswaVirtualAccountHelper.tambahTokenCicilan(cicilan,
							"Bulanan-" + tagihan.getId() + "-" + nilai);

					JSONObject jsonObjectitems = new JSONObject();
					jsonObjectitems.put("description", tagihan.getId() + "-" + commonDesc);
					jsonObjectitems.put("unitPrice", nilai.intValue());
					jsonObjectitems.put("qty", 1);
					jsonObjectitems.put("amount", nilai.intValue());
					items.put(jsonObjectitems);
				}

				if (tabungan != null && tabungan > total) {
					tampilkanPeringatan(
							"Untuk mendapatkan virtual account, tabungan tidak boleh lebih besar dari pada total tagihan",
							warnings);
					return null;
				}

				if (tabungan != null && tabungan > 0) {
					total = total - tabungan;
				}

				if (Common.bolehKonfigurasi("payment_gateway_tolak_total_nol_atau_minus") && total <= 0.0) {
					tampilkanPeringatan("Total tagihan bernilai nol atau minus. Item minus seperti bantuan, beasiswa, potongan, atau koreksi tidak dapat dibuatkan VA sendiri.",
							warnings);
					return null;
				}

				if (kanalPembayarans.size() == 1 && !kanalPembayarans.containsKey(-1L)) {
					kanalPembayaran = kanalPembayarans.values().iterator().next();
				} else if (kanalPembayarans.size() > 1) {
					tampilkanPeringatan("Item biaya yang dipilih tidak boleh menggunakan kanal biaya yang berbeda",
							warnings);
					return null;
				}
			}

			String keterangan = keteranganBuilder.toString();
			String keteranganSimple = keteranganSimpleBuilder.toString();
			String keteranganSimpleBanget = keteranganSimpleBangetBuilder.toString();

			// Mulai buka session Hibernate
			session = MahasiswaVirtualAccountHelper.openSession();

			Date expired_date = hitungWaktuExpired(waktuSampai);

			VirtualAccountBank virtualAccountBankOnline = (VirtualAccountBank) session
					.createCriteria(VirtualAccountBank.class).add(Restrictions.eq("terjadiKendala", false))
					.add(tabungan != null && tabungan > 0.1 ? Restrictions.eq("tabungan", tabungan)
							: Restrictions.sqlRestriction("true"))

					.add(bankHost == null ? Restrictions.isNull("bankHost") : Restrictions.eq("bankHost", bankHost))
					.add(Restrictions.ge("kadaluarsaWaktu", WaktuUtil.getDate()))
					.add(Restrictions.eq("keterangan", keterangan + (qris ? "qris:true" : "")))
					.add(Restrictions.or(Restrictions.eq("calonSiswa", calonSiswa), Restrictions.eq("siswa", siswa)))
					.add(Restrictions.isNull("pembayaran")).setMaxResults(1).addOrder(Order.desc("id")).uniqueResult();

			if (virtualAccountBankOnline != null && virtualAccountBankOnline.getChannel() != null
					&& esmartlinkBayarVia != null
					&& esmartlinkBayarVia.equalsIgnoreCase(virtualAccountBankOnline.getChannel())) {
				update = false;
			}

			if (virtualAccountBankOnline == null || update) {
				if (virtualAccountBankOnline == null) {
					virtualAccountBankOnline = new VirtualAccountBank(PerguruanTinggiUtil.getPerguruanTinggi().getId());
				} else {
					virtualAccountBankOnline.setVa(null);
					virtualAccountBankOnline.setLink(null);
					virtualAccountBankOnline.setResponse(null);
				}

				virtualAccountBankOnline.setKanalPembayaran(kanalPembayaran);

				// ---- SET UP COMMON CUSTOMER INFO UNTUK SEMUA PROVIDER ----
				int mytotal = total.intValue() + (biayaAdmin != null ? biayaAdmin.intValue() : 0);

				// Pastikan expired_date memiliki default +1 Hari jika perhitungan awal null
				if (expired_date == null) {
					Calendar cal = WaktuUtil.getCalendar();
					cal.add(Calendar.DATE, 1);
					expired_date = cal.getTime();
				}

				String sender_name = calonSiswa != null
						? (calonSiswa.getNamaSiswa() != null ? calonSiswa.getNamaSiswa() : calonSiswa.getNama())
						: (siswa != null ? (siswa.getNamaSiswa() != null ? siswa.getNamaSiswa() : siswa.getNama())
								: "");

				String sender_email = sekolah != null ? sekolah.getEmail() : "";
				String sender_phone_number = sekolah != null ? sekolah.getTelp() : "";
				String sender_address = "";

				if (calonSiswa != null) {
					sender_email = !calonSiswa.getAlamatEmail().isEmpty() ? calonSiswa.getAlamatEmail()
							: calonSiswa.generateEmail();
					sender_address = calonSiswa.getAlamatSiswa();
					sender_phone_number = dapatkanNoHpValid(sekolah != null ? sekolah.getTelp() : "",
							calonSiswa.getTeleponSiswa(), calonSiswa.getHp1ayah(), calonSiswa.getHp1ibu());
				} else if (siswa != null) {
					sender_email = !siswa.getAlamatEmail().isEmpty() ? siswa.getAlamatEmail() : siswa.generateEmail();
					sender_address = siswa.getAlamatSiswa();
					sender_phone_number = dapatkanNoHpValid(sekolah != null ? sekolah.getTelp() : "", siswa.getHp(),
							siswa.getTeleponSiswa(), siswa.getHp1ayah(), siswa.getHp1ibu());
				}
				// ------------------------------------------------------------

				if (flip && sekolah != null) {
					String strURL = Common.getKonfigurasi("flip_gateway_url_v2", "https://bigflip.id/api/v2/pwf/bill")
							.getNilai();

					Map<String, Object> params = new HashMap<String, Object>();
					params.put("title", keteranganSimple.trim());
					params.put("amount", mytotal);
					params.put("type", "SINGLE");
					params.put("step", 2);
					params.put("expired_date", Common.databaseDateFormat2.get().format(expired_date));
					params.put("is_address_required", (sender_address.trim().isEmpty() ? 0 : 1));
					params.put("is_phone_number_required", (sender_phone_number.trim().isEmpty() ? 0 : 1));
					params.put("sender_name", sender_name);
					params.put("sender_email", sender_email);
					params.put("sender_phone_number", sender_phone_number);
					params.put("sender_address", sender_address);
					params.put("charge_fee", 1);

					String postData = URLBuilder.httpBuildQuery(params, "UTF-8");
					String authHeader = getBasicAuthenticationHeader(sekolah.getApiKeyFlip(), sekolah.getTokenFlip());

					Map<String, String> headers = new HashMap<String, String>();
					headers.put("Authorization", authHeader);

					String responseStr = Common.executeHttp(strURL, "POST", postData, headers,
							"application/x-www-form-urlencoded");
					JSONObject jSONObject = new JSONObject(responseStr);

					virtualAccountBankOnline.setRequest(postData);
					virtualAccountBankOnline.setResponse(jSONObject.toString());

					if (!jSONObject.isNull("link_url")) {
						virtualAccountBankOnline.setLink(jSONObject.getString("link_url"));
					}
					// FIX JSONException "link_id not found": sebagian respons gateway tak memuat link_id.
					// Guard dgn isNull (seperti link_url di atas) agar tidak melempar; bila absen, kode dilewati.
					if (!jSONObject.isNull("link_id")) {
						virtualAccountBankOnline.setKode(jSONObject.get("link_id") + "");
					}
					virtualAccountBankOnline.setBank("Flip");

				} else if (esmartlink && sekolah != null) {

					if (virtualAccountBankOnline.getResponse() == null
							|| virtualAccountBankOnline.getResponse().trim().isEmpty()) {
						String usernameEsmartlink = kanalPembayaran != null ? kanalPembayaran.getUsernameEsmartlink()
								: sekolah.getUsernameEsmartlink();
						String passwordEsmartlink = kanalPembayaran != null ? kanalPembayaran.getPasswordEsmartlink()
								: sekolah.getPasswordEsmartlink();

						if (!sekolah.getVariableBiayaAdminEsmartlink().isEmpty() && esmartlinkBayarVia == null) {
							MyWindow window = new MyWindow("Pilih Channel Pembayaran", "none", true);
							window.setParent(ExecutionsCtrl.getCurrentCtrl().getCurrentPage().getFirstRoot());
							SmartlinkChannelWindow.init(window, siswa, calonSiswa, tag, param, biayaAdmin, tabungan,
									topup, bankHost, akunPembayaranSiswa, sekolah, keterangan, total, true,
									kanalPembayaran);
							window.setHeight("90%");
							window.setWidth("600px");
							window.setVisible(true);
							window.onModal();
							return null;
						} else {
							try {
								String va = Common.getGeneratedBarCode(30);
								JSONObject postData = new JSONObject();
								postData.put("order_id", va);
								postData.put("amount", mytotal);
								postData.put("description", keteranganSimpleBanget);

								JSONObject customer = new JSONObject();
								customer.put("name", sender_name.replaceAll("[^\\sa-zA-Z0-9]", ""));
								customer.put("email", sender_email);
								customer.put("phone", sender_phone_number);
								postData.put("customer", customer);

								JSONArray itemsSmartlink = new JSONArray();
								for (int i = 0; i < items.length(); i++) {
									JSONObject d = items.getJSONObject(i);
									int amount = d.getInt("amount");
									if (amount != 0) {
										JSONObject jsonObject = new JSONObject();

										String description = d.getString("description");
										if (description.length() > 255) {
											description = description.substring(0, 255);
										}

										jsonObject.put("name", description);
										jsonObject.put("amount", amount);
										jsonObject.put("qty", 1);
										itemsSmartlink.put(jsonObject);
									}
								}
								postData.put("item", itemsSmartlink);

								JSONArray channel = new JSONArray();
								if (esmartlinkBayarVia == null) {
									String cannel_va_e_smartlink = Common
											.getKonfigurasi("cannel_va_e_smartlink", "VA_CIMB,VA_BRI").getNilai();
									String[] ch = cannel_va_e_smartlink.split(",");
									for (String c : ch) {
										if (!c.trim().isEmpty())
											channel.put(c.trim());
									}
								} else {
									channel.put(esmartlinkBayarVia);
								}
								postData.put("channel", channel);

								String link = Common.bolehKonfigurasi("dapatkan_code_via_url_custom", Konfigurasi.TIDAK_AKTIF)
												? Common.getKonfigurasi("CURRENT_URL",
														Common.getRequestHostWithProtocol()).getNilai()
												: Common.getRequestHostWithProtocol();

								postData.put("type", "payment-page");
								postData.put("payment_mode", "CLOSE");
								postData.put("expired_time", Common.iso8601.get().format(expired_date));
								postData.put("callback_url", link + "/Esmartlink");
								postData.put("success_redirect_url", link + "/PembayaranSukses");
								postData.put("failed_redirect_url", link + "/PembayaranGagal");

								String strURL = Common.getKonfigurasi("gateway_url_va_e_smartlink",
										"https://payment-service-sbx.pakar-digital.com/api/payment/create-order")
										.getNilai();
								String hasil = VirtualAccountBank.curlSmartlink(strURL, usernameEsmartlink,
										passwordEsmartlink, postData);

								JSONObject jSONObject = new JSONObject(hasil);

								if (!(jSONObject.get("code") + "").equals("0")) {
									try {
										if (warnings != null) {
											warnings.add(jSONObject.getString("message"));
										}
									} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:421");
										// TODO: handle exception
									}
									return null;
								}

								JSONObject data = jSONObject.getJSONObject("data");
								virtualAccountBankOnline.setRequest(postData.toString());
								virtualAccountBankOnline.setResponse(jSONObject.toString());
								virtualAccountBankOnline.setLink(data.getString("payment_url"));
								virtualAccountBankOnline.setKode(va);
								virtualAccountBankOnline.setBank("Esmartlink");

							} catch (Exception e) {
								tampilkanPeringatan(e.getMessage(), warnings);
								e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:436");
								return null;
							}
						}
					}

				} else if (finpay && sekolah != null) {
					String strURL = Common.getKonfigurasi("finpay_gateway_url_data",
							"https://devo.finnet.co.id/pg/payment/card/initiate").getNilai();

					JSONObject postData = new JSONObject();
					JSONObject customer = new JSONObject();
					customer.put("email", sender_email);
					customer.put("firstName", sender_name);
					customer.put("lastName", sekolah.getNama());
					customer.put("mobilePhone", sender_phone_number);
					postData.put("customer", customer);

					String va = WaktuUtil.getDate().getTime() + "";
					JSONObject order = new JSONObject();
					order.put("id", va);
					order.put("amount", mytotal + "");
					order.put("description", keteranganSimpleBanget.trim());
					postData.put("order", order);

					JSONObject urlParam = new JSONObject();
					urlParam.put("callbackUrl", Common.CURRENT_URL + "/Finpay");
					postData.put("url", urlParam);

					String screet_key = getBasicAuthenticationHeader(sekolah.getApiKeyFinpay(),
							sekolah.getTokenFinpay());

					Map<String, String> headers = new HashMap<String, String>();
					headers.put("Authorization", screet_key);

					String responseStr = Common.executeHttp(strURL, "POST", postData.toString(), headers,
							"application/json");
					JSONObject jSONObject = new JSONObject(responseStr);

					try {
						virtualAccountBankOnline
								.setKadaluarsa(Common.databaseDateFormat1.get().parse(jSONObject.get("expiryLink") + ""));
					} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:478");
					}

					virtualAccountBankOnline.setRequest(postData.toString());
					virtualAccountBankOnline.setResponse(jSONObject.toString());

					if (!jSONObject.isNull("redirecturl")) {
						virtualAccountBankOnline.setLink(jSONObject.getString("redirecturl"));
					} else {
						return null;
					}
					virtualAccountBankOnline.setKode(va);
					virtualAccountBankOnline.setBank("Finpay");

				} else if (qris) {
					try {
						JSONObject postData = new JSONObject();
						String va = Common.getGeneratedAngkaDigit(10);
						postData.put("merchantId",
								Common.getKonfigurasi("qris_jaring_merchantId", "<REDACTED_MERCHANT_ID>").getNilai());
						postData.put("terminalId",
								Common.getKonfigurasi("qris_jaring_terminalId", "<REDACTED_TERMINAL_ID>").getNilai());
						postData.put("trxId", va);
						postData.put("amount", mytotal + "");
						postData.put("expire", Common.getKonfigurasi("qris_jaring_expire", "7200").getNilai());
						postData.put("posId", siswa.getNim());
						postData.put("timestamp", Common.databaseDateFormat1.get().format(WaktuUtil.getDate()));

						String strURL = Common.getKonfigurasi("qris_jaring_gateway_url",
								"http://api.jsa2.host/agg/api/v1/qris/generate").getNilai();
						String screet_key = Common.getKonfigurasi("qris_jaring_screet_key", "<REDACTED_SECRET_KEY>").getNilai();

						String sign = postData.getString("merchantId") + postData.getString("terminalId")
								+ postData.getString("posId") + postData.getString("trxId")
								+ postData.getString("amount") + postData.getString("expire")
								+ postData.getString("timestamp") + screet_key;
						String token = DigestUtils.sha256Hex(sign);
						postData.put("signature", token);

						Map<String, String> headers = new HashMap<String, String>();
						headers.put("Authorization", "Basic " + screet_key);
						headers.put("Accept", "application/json");

						String responseStr = Common.executeHttp(strURL, "POST", postData.toString(), headers,
								"application/x-www-form-urlencoded");
						JSONObject jSONObject = new JSONObject(responseStr);

						if (!jSONObject.getString("ack").equals("00"))
							return null;

						String data = jSONObject.getString("data");
						byte[] decodedBytes = org.apache.commons.codec.binary.Base64.decodeBase64(data);
						JSONObject jSONObjectDecode = new JSONObject(new String(decodedBytes));

						virtualAccountBankOnline.setRequest(postData.toString());
						virtualAccountBankOnline.setResponse(jSONObjectDecode.toString());
						virtualAccountBankOnline.setKode(jSONObjectDecode.getString("rawQRIS"));
						virtualAccountBankOnline.setBank("QRIS");
					} catch (Exception e) {
						e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:537");
						return null;
					}

				} else if (maja || Common.bolehKonfigurasi("aktifkan_va_maja", Konfigurasi.TIDAK_AKTIF)) {
					try {
						JSONObject jsonObject = new JSONObject();
						String va = Common.getGeneratedAngkaDigit(10);
						jsonObject.put("date", Common.databaseDateFormat.get().format(new Date()));
						if (Common.bolehKonfigurasi("maja_pakai_tanpa_amount")) {
							jsonObject.put("amount", mytotal);
						}

						if (calonSiswa != null && calonSiswa.getId() != null) {
							jsonObject.put("name", calonSiswa.getNama());
							jsonObject.put("email", calonSiswa.getAlamatEmail());
							jsonObject.put("address", calonSiswa.getAlamatSiswa());
							jsonObject.put("va", va);
							jsonObject.put("attribute1", calonSiswa.getYayasan().getNama());
							jsonObject.put("attribute2", calonSiswa.getSekolah().getNama());
							jsonObject.put("attribute3", calonSiswa.getNoRegistrasi());
							jsonObject.put("attribute4", calonSiswa.getStatusAwalSiswa() == null ? ""
									: calonSiswa.getStatusAwalSiswa().getNama());
							jsonObject.put("attribute5", calonSiswa.getTeleponSiswa());
						} else {
							jsonObject.put("name", siswa.getNama());
							jsonObject.put("email", siswa.getAlamatEmail());
							jsonObject.put("address", siswa.getAlamatSiswa());
							jsonObject.put("va", va);
							jsonObject.put("attribute1", siswa.getYayasan().getNama());
							jsonObject.put("attribute2", siswa.getSekolah().getNama());
							jsonObject.put("attribute3", siswa.getNim());
							jsonObject.put("attribute4",
									siswa.getStatusAwalSiswa() == null ? "" : siswa.getStatusAwalSiswa().getNama());
							jsonObject.put("attribute5", siswa.getProgram());
						}

						jsonObject.put("items", items);
						jsonObject.put("attributes", new JSONArray());

						String CLIENT_TOKEN = BSIMajaUtil.sendRequestToken(sekolah, kanalPembayaran);
						JSONObject jsonObject2 = BSIMajaUtil.sendRequest(jsonObject, CLIENT_TOKEN, sekolah,
								kanalPembayaran, true);

						virtualAccountBankOnline.setRequest(jsonObject.toString());
						virtualAccountBankOnline.setResponse(jsonObject2.toString());
						virtualAccountBankOnline.setKode(va);
						virtualAccountBankOnline.setBank("Maja");
					} catch (Exception e) {
						e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:586");
						return null;
					}

				} else if (Common.bolehKonfigurasi("aktifkan_va_jaring", Konfigurasi.TIDAK_AKTIF)) {
					try {
						String va = Common.getGeneratedAngkaDigit(10);
						JSONObject postData = new JSONObject();
						postData.put("custName", siswa.getNama());
						postData.put("custID", siswa.getNim());
						postData.put("trxID", va);
						postData.put("productID", Common.getKonfigurasi("va_jaring_produk_id", "207").getNilai());
						postData.put("paymentType", Common.getKonfigurasi("va_jaring_payment_type", "04").getNilai());
						postData.put("productName", "");
						postData.put("amount", mytotal + "");
						postData.put("expire", Common.getKonfigurasi("va_jaring_expire", "1440").getNilai());
						postData.put("urlCallback", Common.getRequestHostWithProtocol() + "/Jaring");
						postData.put("timestamp", Common.databaseDateFormat1.get().format(WaktuUtil.getDate()));

						String strURL = Common.getKonfigurasi("va_jaring_gateway_url",
								"http://sandbox.jaring.host/api/v3/billpay/inquiry").getNilai();
						String screet_key = Common.getKonfigurasi("va_jaring_screet_key", "<REDACTED_SECRET_KEY>")
								.getNilai();

						String sign = postData.getString("custName") + postData.getString("custID")
								+ postData.getString("trxID") + postData.getString("productID")
								+ postData.getString("productName") + postData.getString("paymentType")
								+ postData.getString("timestamp") + postData.getString("amount")
								+ postData.getString("expire") + postData.getString("urlCallback") + screet_key;
						String token = DigestUtils.sha256Hex(sign);
						postData.put("signature", token);

						Map<String, String> headers = new HashMap<String, String>();
						headers.put("Authorization", "Basic " + screet_key);
						headers.put("Accept", "application/json");

						String responseStr = Common.executeHttp(strURL, "POST", postData.toString(), headers,
								"application/x-www-form-urlencoded");
						JSONObject jSONObject = new JSONObject(responseStr);

						if (!jSONObject.getString("ack").equals("00"))
							return null;

						virtualAccountBankOnline.setRequest(postData.toString());
						virtualAccountBankOnline.setResponse(jSONObject.toString());
						virtualAccountBankOnline.setKode(jSONObject.getString("payCode"));
						virtualAccountBankOnline.setBank("Jaring");
					} catch (Exception e) {
						e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:634");
						return null;
					}

				} else if (bjb_langsung || Common.bolehKonfigurasi("aktifkan_va_bjb_langsung", Konfigurasi.TIDAK_AKTIF)) {
					try {
						String va = Common.getGeneratedAngkaDigit(12);
						String product_code = Common.maxPanjangAkhir("00", 2);

						JSONObject postData = new JSONObject();
						postData.put("customer_email", siswa.getAlamatEmail());
						postData.put("billing_type", "f");
						postData.put("customer_code", va);
						postData.put("customer_phone", sender_phone_number);
						postData.put("description", Common.maxPanjangAkhir(keterangan, 1000));
						postData.put("client_refnum", va);
						postData.put("amount", mytotal + "");
						postData.put("customer_name", sender_name.replaceAll("[^\\sa-zA-Z0-9]", ""));
						postData.put("product_code", product_code);
						postData.put("cin", Common.getKonfigurasi("bjb_langsung_cin", "530").getNilai());
						postData.put("expired_date", Common.databaseDateFormat1.get().format(expired_date));
						postData.put("client_type", "1");
						postData.put("va_type", "m");
						postData.put("currency", "360");

						JSONObject jSONObject = BJBUtil.billingBJB(postData.toString(), true);

						virtualAccountBankOnline.setRequest(postData.toString());
						virtualAccountBankOnline.setResponse(jSONObject.toString());
						virtualAccountBankOnline.setKode(jSONObject.getString("va_number"));
						virtualAccountBankOnline.setBank("BJB");
					} catch (Exception e) {
						e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:666");
						return null;
					}
				} else {
					// Fallback ke VA Bank Online 2
					int jml_digit_prefix = 10;
					try {
						jml_digit_prefix = Integer.parseInt(Common
								.getKonfigurasi("jml_digit_prefix_va_bank_online_" + sekolah.getId(),
										Common.getKonfigurasi("jml_digit_prefix_va_bank_online", "10").getNilai())
								.getNilai());
					} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:677");
					}

					String va;
					if (Common.bolehKonfigurasi("gen_va_menggunakan_nis")) {
						String nisVa = siswa != null
								? (!siswa.getNomorInduk().isEmpty() ? siswa.getNomorInduk()
										: siswa.getNomorIndukNasional())
								: (calonSiswa != null && calonSiswa.getNoRegistrasi() != null
										? calonSiswa.getNoRegistrasi()
										: "");

						if (nisVa.trim().isEmpty()) {
							nisVa = Common.getGeneratedAngkaDigit(jml_digit_prefix);
						} else {
							nisVa = "000000000000000000000000" + nisVa;
							nisVa = nisVa.substring(nisVa.length() - jml_digit_prefix);
						}

						String prefixVa = Common.getKonfigurasi("prefix_va_bank_online_" + sekolah.getId(),
								Common.getKonfigurasi("prefix_va_bank_online", "").getNilai()).getNilai();
						va = prefixVa + nisVa;
					} else {
						String prefixVa = Common.getKonfigurasi("prefix_va_bank_online_" + sekolah.getId(),
								Common.getKonfigurasi("prefix_va_bank_online", "").getNilai()).getNilai();
						va = prefixVa + Common.getGeneratedAngkaDigit(jml_digit_prefix);
					}

					virtualAccountBankOnline.setKode(va);
					virtualAccountBankOnline.setBank("Bank Online 2");
				}

				// Finalisasi Entitas
				virtualAccountBankOnline.setKadaluarsa(expired_date);
				virtualAccountBankOnline.setOtomatis(false);
				virtualAccountBankOnline.setCicilan(cicilan);
				virtualAccountBankOnline.setKeterangan(keterangan + (qris ? "qris:true" : ""));
				virtualAccountBankOnline.setTotal(total);
				virtualAccountBankOnline.setBulanan("");
				virtualAccountBankOnline.setBiayaAdmin(biayaAdmin);
				virtualAccountBankOnline.setSiswa(siswa);
				virtualAccountBankOnline.setCalonSiswa(calonSiswa);
				virtualAccountBankOnline.setBankHost(bankHost);
				virtualAccountBankOnline.setAkunPembayaranSiswa(akunPembayaranSiswa);
				virtualAccountBankOnline.setTabungan(tabungan);
				virtualAccountBankOnline.setTopup(topup);

				// Transaksi Batch (Sangat Efisien dibanding Commit per iterasi loop)
				try {
					MahasiswaVirtualAccountHelper.beginTransactionIfNeeded(session);
					session.saveOrUpdate(virtualAccountBankOnline);

					if (tagihans != null) {
						for (Tagihan tagihan : tagihans) {
							tagihan.setVa(virtualAccountBankOnline.getKode());
							tagihan.setExpired(expired_date);
							tagihan.setLink(virtualAccountBankOnline.getLink());
							session.update(tagihan);
						}
					}
					MahasiswaVirtualAccountHelper.commitTransactionIfActive(session);
				} catch (Exception e) {
					MahasiswaVirtualAccountHelper.rollbackTransactionIfActive(session);
					e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:740");
				}
			}

			return virtualAccountBankOnline;

		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
			return null;
		} finally {
			// Memastikan session PASTI DITUTUP bagaimanapun kondisi return atau Exception
			MahasiswaVirtualAccountHelper.closeSessionQuietly(session);
			MahasiswaVirtualAccountHelper.closeHibernateContextQuietly();
		}
	}

	// ===================== HELPER METHODS =====================

	private static Date hitungWaktuExpired(String waktuSampai) {
		Date expired_date = null;
		if (waktuSampai != null) {
			try {
				Calendar calendar = WaktuUtil.getCalendar();
				if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_15_MENIT))
					calendar.add(Calendar.MINUTE, 15);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_30_MENIT))
					calendar.add(Calendar.MINUTE, 30);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_1_JAM))
					calendar.add(Calendar.HOUR_OF_DAY, 1);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_3_JAM))
					calendar.add(Calendar.HOUR_OF_DAY, 3);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_6_JAM))
					calendar.add(Calendar.HOUR_OF_DAY, 6);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_24_JAM))
					calendar.add(Calendar.DATE, 1);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_3_HARI))
					calendar.add(Calendar.DATE, 3);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_1_MINGGU))
					calendar.add(Calendar.DATE, 7);
				else if (waktuSampai.equals(SmartlinkChannelWindow.WAKTU_1_BULAN))
					calendar.add(Calendar.MONTH, 1);
				return calendar.getTime();
			} catch (Exception e) {
				e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:783");
			}
		}

		boolean tagihanExpiredAkhirHari = Common.getKonfigurasi("tagihan_expired_akhir_hari", Konfigurasi.TIDAK_AKTIF)
				.getNilai().trim().equals(Konfigurasi.AKTIF);

		if (tagihanExpiredAkhirHari) {
			try {
				Calendar calendar = WaktuUtil.getCalendar();
				calendar.set(Calendar.HOUR_OF_DAY, 23);
				calendar.set(Calendar.MINUTE, 59);
				calendar.set(Calendar.SECOND, 59);
				expired_date = calendar.getTime();
			} catch (Exception e) {
				e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:798");
			}
		} else {
			String jam = Common.getKonfigurasi("tagihan_expired_jam", "").getNilai();
			if (!jam.isEmpty() && !jam.equalsIgnoreCase("0")) {
				try {
					Calendar cal = WaktuUtil.getCalendar();
					cal.add(Calendar.HOUR_OF_DAY, Integer.parseInt(jam));
					expired_date = cal.getTime();
				} catch (Exception e) {
					e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:808");
				}
			} else {
				String hari = Common.getKonfigurasi("tagihan_expired_day", "0").getNilai();
				if (!hari.isEmpty() && !hari.equalsIgnoreCase("0")) {
					try {
						Calendar cal = WaktuUtil.getCalendar();
						cal.add(Calendar.DATE, Integer.parseInt(hari));
						expired_date = cal.getTime();
					} catch (Exception e) {
						e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:818");
					}
				}
			}
		}
		return expired_date;
	}

	private static String dapatkanNoHpValid(String fallback, String... phones) {
		for (String phone : phones) {
			if (phone != null && !phone.trim().isEmpty() && phone.length() > 8 && phone.length() < 15
					&& !phone.equals("08100000000000000000") && !phone.equals("0000000000")) {
				return phone;
			}
		}
		return fallback;
	}

	private static void tampilkanPeringatan(String message, List<String> warnings) {
		try {
			if (warnings != null) {
				warnings.add(message);
			} else {
				MyMessageboxConfig.show(message, "Peringatan", MyMessageboxConfig.OK, MyMessageboxConfig.INFORMATION);
			}
		} catch (Exception ignore) { ais.common.ErrorAuditUtil.record(ignore, "auto-audit(empty-catch) src/ais/action/master/helper/virtualaccount/DownloadTagihanSiswaBankOnline.java:843");
		}
	}

}