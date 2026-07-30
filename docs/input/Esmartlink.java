package ais.action.servlet;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.hibernate.Session;
import org.hibernate.criterion.Criterion;
import org.hibernate.criterion.MatchMode;
import org.hibernate.criterion.Order;
import org.hibernate.criterion.Projections;
import org.hibernate.criterion.Restrictions;
import org.json.JSONArray;
import org.json.JSONObject;

import ais.action.master.helper.PembayaranUtilHelper;
import ais.action.ws.util.PembayaranUtil;
import ais.common.Common;
import ais.common.ConstantValues;
import ais.database.hibernate.HibernateUtil;
import ais.database.model.BankHost;
import ais.database.model.BiodataCalonMahasiswa;
import ais.database.model.CicilanPembayaran;
import ais.database.model.DetailBiaya;
import ais.database.model.ItemBiaya;
import ais.database.model.JenisKegiatan;
import ais.database.model.Kegiatan;
import ais.database.model.KegiatanTemporary;
import ais.database.model.LogHostToHost;
import ais.database.model.Mahasiswa;
import ais.database.model.PengaturanPembayaranBulanan;
import ais.database.model.VirtualAccountBank;

/**
 * Servlet implementation class CheckISBN
 */
public class Esmartlink extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private static PembayaranUtil pembayaranUtil = PembayaranUtil.getInstance();
	private static final String BANK_NAME = "Esmartlink";

	/**
	 * @see HttpServlet#HttpServlet()
	 */
	public Esmartlink() {
		super();
	}

	/**
	 * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse
	 *      response)
	 */
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {
		try {
			process(request, response);
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse
	 *      response)
	 */
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {
		try {
			process(request, response);
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse
	 *      response)
	 */
	protected void doPut(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {
		try {
			process(request, response);
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse
	 *      response)
	 */
	protected void doTrace(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {
		try {
			process(request, response);
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
		}
	}

	public static String doProcess(double nominalP, String tanggalP, String va, String bank, BankHost bankHost,
			HttpServletRequest request, String data, boolean chekLagi, boolean inquery, boolean chek) throws Exception {

		{ // TANPA syarat bankHost: request bank apa pun WAJIB tercatat ke log H2H (lihat finally)
			String nim = "";
			String nama = "";
			JSONArray rincian = new JSONArray();
			// Jejak stack trace bila inquiry/pembayaran error; disimpan ke kolom log H2H.
			String h2hStackTrace = null;

			VirtualAccountBank virtualAccountBankNtt = null;
			Session session = null;
			try {
				Criterion crit = null;

				try {
					JSONObject req = new JSONObject(data);
					JSONObject dataReq = req.getJSONObject("data");
					String transaction_id = dataReq.get("transaction_id") + "";
					if (transaction_id != null && !transaction_id.trim().isEmpty()) {
						crit = Restrictions.ilike("response", transaction_id, MatchMode.ANYWHERE);
					}
				} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/servlet/Esmartlink.java:133");
					// TODO: handle exception
				}

				virtualAccountBankNtt = VirtualAccountBank.ambilVa(va, nominalP, bankHost, crit);

				if (virtualAccountBankNtt != null && virtualAccountBankNtt.getTotal() > 0.1) {
					session = HibernateUtil.getSessionFactory().openSession();

					Date tanggal = parseTanggalTransaksi(tanggalP);
					nim = ambilNomorInduk(virtualAccountBankNtt);
					nama = ambilNama(virtualAccountBankNtt);

					if (VirtualAccountBank.isSudahTerbayarUntukPayment(virtualAccountBankNtt, inquery, false, chek)) {
						System.out.println("Callback " + BANK_NAME + " untuk VA " + va
								+ " sudah pernah diproses. Proses pembayaran dilewati.");
					} else {
						VirtualAccountBank.bayarTopup(virtualAccountBankNtt, session, tanggal, bank, inquery, data);

						if (virtualAccountBankNtt.getSiswa() != null || virtualAccountBankNtt.getCalonSiswa() != null) {

							if (virtualAccountBankNtt.getSiswa() != null) {

								nim = virtualAccountBankNtt.getSiswa().getNomorInduk();
								nama = virtualAccountBankNtt.getSiswa().getNama();

							} else if (virtualAccountBankNtt.getCalonSiswa() != null) {

								nim = virtualAccountBankNtt.getCalonSiswa().getNomorInduk();
								nama = virtualAccountBankNtt.getCalonSiswa().getNama();

							}

							VirtualAccountBank.bayarSiswa(virtualAccountBankNtt, session, tanggal, bank, inquery, data,
									false);

						} else {

							JenisKegiatan jenisKegiatan = virtualAccountBankNtt.getJenisKegiatan();
							Mahasiswa mahasiswa = virtualAccountBankNtt.getMahasiswa();
							BiodataCalonMahasiswa biodataCalonMahasiswa = virtualAccountBankNtt
									.getBiodataCalonMahasiswa();

							Integer semester = virtualAccountBankNtt.getSemester();

							nim = ambilNomorInduk(mahasiswa, biodataCalonMahasiswa);
							nama = ambilNama(mahasiswa, biodataCalonMahasiswa);

							prosesRincianVAEsmartlink(session, virtualAccountBankNtt, inquery, bank, bankHost, tanggal,
									data, mahasiswa, biodataCalonMahasiswa, semester, jenisKegiatan, rincian);

						}
					}
				}

			} catch (Exception e) {
				HibernateUtil.rollbackTransaction();

				h2hStackTrace = ais.action.ws.util.PembayaranGatewayHelper.ambilStackTrace(e);
				Common.tampilErrorJikaAdmin(e);
			} finally {
				if (session != null) {
					try { session.clear(); } catch (Exception e2) { ais.common.ErrorAuditUtil.record(e2, "auto-audit(empty-catch) src/ais/action/servlet/Esmartlink.java:195");}
					try { session.disconnect(); } catch (Exception e2) { ais.common.ErrorAuditUtil.record(e2, "auto-audit(empty-catch) src/ais/action/servlet/Esmartlink.java:196");}
					try { session.close(); } catch (Exception e2) { ais.common.ErrorAuditUtil.record(e2, "auto-audit(empty-catch) src/ais/action/servlet/Esmartlink.java:197");}
				}
				// JAMINAN: log H2H SELALU dicatat & tercommit walau terjadi error/exception, dan
				// TANPA syarat bankHost (request dari IP tak dikenal pun WAJIB tercatat).
				ais.action.ws.util.PembayaranGatewayHelper.catatLogHostToHost(request, bankHost, data, nim, va, nama,
						"OK", nominalP, rincian.toString(), h2hStackTrace);
			}
		}
		return "OK";
	}

	private static Date parseTanggalTransaksi(String tanggalP) {
		Date tanggal = ais.ui.util.WaktuUtil.getDate();
		if (tanggalP == null || tanggalP.trim().length() == 0) {
			return tanggal;
		}
		try {
			return Common.iso8601.get().parse(tanggalP);
		} catch (Exception e) {
			Common.tampilErrorJikaAdmin(e);
			return tanggal;
		}
	}

	private static String ambilNomorInduk(VirtualAccountBank virtualAccountBank) {
		if (virtualAccountBank == null) {
			return "";
		}
		if (virtualAccountBank.getSiswa() != null) {
			return virtualAccountBank.getSiswa().getNomorInduk();
		}
		if (virtualAccountBank.getCalonSiswa() != null) {
			return virtualAccountBank.getCalonSiswa().getNomorInduk();
		}
		return ambilNomorInduk(virtualAccountBank.getMahasiswa(), virtualAccountBank.getBiodataCalonMahasiswa());
	}

	private static String ambilNomorInduk(Mahasiswa mahasiswa, BiodataCalonMahasiswa biodataCalonMahasiswa) {
		if (mahasiswa != null) {
			return mahasiswa.getNim();
		}
		if (biodataCalonMahasiswa != null) {
			return biodataCalonMahasiswa.getNoRegistrasi();
		}
		return "";
	}

	private static String ambilNama(VirtualAccountBank virtualAccountBank) {
		if (virtualAccountBank == null) {
			return "";
		}
		if (virtualAccountBank.getSiswa() != null) {
			return virtualAccountBank.getSiswa().getNama();
		}
		if (virtualAccountBank.getCalonSiswa() != null) {
			return virtualAccountBank.getCalonSiswa().getNama();
		}
		return ambilNama(virtualAccountBank.getMahasiswa(), virtualAccountBank.getBiodataCalonMahasiswa());
	}

	private static String ambilNama(Mahasiswa mahasiswa, BiodataCalonMahasiswa biodataCalonMahasiswa) {
		if (mahasiswa != null) {
			return mahasiswa.getNama();
		}
		if (biodataCalonMahasiswa != null) {
			return biodataCalonMahasiswa.getNama();
		}
		return "";
	}

	public static String doProses(String data, HttpServletRequest request, BankHost bankHost, String bank, boolean chek)
			throws Exception {
		JSONObject req = new JSONObject(data);
		JSONObject dataReq = req.getJSONObject("data");
		String va = dataReq.get("order_id") + "";

		double nominalP = 0.0;
		try {
			nominalP = Double.parseDouble(dataReq.get("amount") + "");
		} catch (Exception e) { ais.common.ErrorAuditUtil.record(e, "auto-audit(empty-catch) src/ais/action/servlet/Esmartlink.java:276");
			// TODO: handle exception
		}

		String tanggalP = dataReq.get("transaction_time") + "";

		String body;
		try {
			String status = req.isNull("data") || req.getJSONObject("data").isNull("status") ? "ERROR"
					: req.getJSONObject("data").get("status") + "";
			boolean masuk = status.trim().equalsIgnoreCase("success");
			body = Esmartlink.doProcess(nominalP, tanggalP, va, bank, bankHost, request, data, true, !masuk, chek)
					.toString();
		} catch (Exception e) {
			e.printStackTrace(); ais.common.ErrorAuditUtil.record(e, "auto-audit src/ais/action/servlet/Esmartlink.java:290");
			body = "ERROR";
		}

		return body;
	}

	@SuppressWarnings({})
	private void process(HttpServletRequest request, HttpServletResponse response) throws Exception {

		StringBuilder buffer = new StringBuilder();
		BufferedReader reader = request.getReader();
		String line;
		while ((line = reader.readLine()) != null) {
			buffer.append(line);
		}
		String data = buffer.toString();

		String querystring = request.getQueryString();
		System.out.println("==> VA data => " + data);
		System.out.println("==> VA querystring => " + querystring);

		String bank = BANK_NAME;
		BankHost bankHost = pembayaranUtil.getBankHost(request.getRemoteAddr(), bank);

		String body = data == null || data.isEmpty() ? "" : doProses(data, request, bankHost, bank, false);

		response.setHeader("length", body.length() + "");
		response.setHeader("Content-Type", "application/json");
		PrintWriter writer = response.getWriter();

		writer.write(body);

	}

	/**
	 * Helper Method untuk memproses detail rincian pembayaran (Keranjang / Cicilan
	 * / Json Request) Digunakan untuk menyederhanakan class Esmartlink.doProcess
	 */
	@SuppressWarnings("unchecked")
		private static void prosesRincianVAEsmartlink(Session session, VirtualAccountBank virtualAccountBankNtt,
			boolean inquery, String bank, BankHost bankHost, Date tanggal, String data, Mahasiswa mahasiswa,
			BiodataCalonMahasiswa biodataCalonMahasiswa, Integer semester, JenisKegiatan jenisKegiatan,
			JSONArray rincian) throws Exception {
		// Logika dipindah ke helper bersama agar reuse lintas servlet payment gateway.
		ais.action.ws.util.PembayaranGatewayHelper.prosesRincianVA(session, virtualAccountBankNtt, inquery, bank,
				bankHost, tanggal, data, mahasiswa, biodataCalonMahasiswa, semester, jenisKegiatan, rincian);
	}

}
