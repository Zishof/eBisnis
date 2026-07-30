<%@page import="ais.database.model.Konfigurasi"%>
<%@page import="ais.database.model.Pendaftar"%>
<%@page import="ais.common.Common"%>
<%@page import="ais.action.servlet.EbisnisPublicServlet"%>
<%@page import="org.apache.commons.lang.StringEscapeUtils"%>
<%@ page import="java.util.Calendar" %>
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%
// ============================================================================================
// ebisnis.jsp -- landing page publik platform ebisnis.id (dibangun di atas template
// visual erp.jsp: CSS/JS/struktur hero-nav-section-footer SAMA, konten diganti).
// BEDA dari erp.jsp: halaman ini TIDAK terikat satu institusi (Sekolah/PerguruanTinggi)
// -- ebisnis.id adalah produk SaaS publik yang sama utk semua pengunjung, jadi tidak
// ada lookup pt/sekolah/white-label di sini.
// ============================================================================================
String judul = "ebisnis.id";
String judulHeader = "ebisnis.id";
String logo_PerguruanTinggi = request.getContextPath() + "/img/logo_ebisnis.png";

String rnd = String.valueOf(System.currentTimeMillis());
long cacheBuster = System.currentTimeMillis();
String currentUrl = request.getRequestURL().toString();

// ============================================================================================
// SESI PENDAFTAR (hasil Daftar/Masuk via EbisnisPublicServlet) + flash message sekali-tampil
// ============================================================================================
Pendaftar sesiPendaftar = (Pendaftar) session.getAttribute(EbisnisPublicServlet.SESSION_PENDAFTAR);
boolean sudahLoginPendaftar = sesiPendaftar != null;
String sesiPendaftarNama = sesiPendaftar == null ? "" : sesiPendaftar.getNama();
String flashPesan = (String) session.getAttribute(EbisnisPublicServlet.SESSION_FLASH);
String flashJenis = (String) session.getAttribute(EbisnisPublicServlet.SESSION_FLASH_JENIS);
session.removeAttribute(EbisnisPublicServlet.SESSION_FLASH);
session.removeAttribute(EbisnisPublicServlet.SESSION_FLASH_JENIS);
%>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta 
        name="viewport" 
        content="width=device-width, initial-scale=1.0"
    >
    <title><%= Common.getBahasaConfig("ebisnis.id - Platform SaaS POS & ERP Retail Terintegrasi") %></title>

    <meta
        name="description"
        content="<%= Common.getBahasaConfig("ebisnis.id adalah platform SaaS multi-tenant untuk POS, ERP retail dan manufaktur, pusat data, dan API terintegrasi. Daftarkan bisnis Anda, aktifkan mesin kasir via QR Code, kelola banyak brand dan toko/gerai, serta jalankan SDM, Payroll, Akunting, Logistik, Produksi, dan bagi hasil investor dalam satu sistem.") %>"
    >
    <meta
        name="keywords"
        content="ebisnis.id, SaaS POS, Aplikasi Kasir, ERP Retail, ERP Manufaktur, Sistem Kasir Cloud, Multi Outlet, Multi Brand, Manajemen Toko, Bagi Hasil Investor, Payroll, SDM, Akuntansi Terpadu, Logistik, Ekspedisi, Gudang, Inventory, Smartlink, Langganan Kasir, POS Offline, QR Aktivasi Mesin Kasir"
    >
    <meta 
        name="author" 
        content="<%=judul%>"
    >
    <meta 
        name="robots" 
        content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    >
    <link 
        rel="canonical" 
        href="<%= currentUrl %>"
    >

    <meta 
        property="og:type" 
        content="website"
    >
    <meta 
        property="og:url" 
        content="<%= currentUrl %>"
    >
    <meta
        property="og:title"
        content="<%= Common.getBahasaConfig("ebisnis.id - Platform SaaS POS & ERP Retail Terintegrasi") %>"
    >
    <meta
        property="og:description"
        content="<%= Common.getBahasaConfig("Daftarkan bisnis Anda, aktifkan mesin kasir via QR Code, kelola banyak brand dan toko/gerai, serta jalankan SDM, Payroll, Akunting, Logistik, Produksi, dan bagi hasil investor dalam satu sistem.") %>"
    >
    <meta 
        property="og:image" 
        content="<%=logo_PerguruanTinggi%>"
    >
    <meta 
        property="og:site_name" 
        content="<%=judul%>"
    >

    <meta 
        name="twitter:card" 
        content="summary_large_image"
    >
    <meta
        name="twitter:title"
        content="<%= Common.getBahasaConfig("ebisnis.id - Platform SaaS POS & ERP Retail Terintegrasi") %>"
    >
    <meta
        name="twitter:description"
        content="<%= Common.getBahasaConfig("Daftarkan bisnis Anda, aktifkan mesin kasir via QR Code, kelola banyak brand dan toko/gerai, serta jalankan SDM, Payroll, Akunting, Logistik, Produksi, dan bagi hasil investor dalam satu sistem.") %>"
    >
    <meta 
        name="twitter:image" 
        content="<%=logo_PerguruanTinggi%>"
    >

    <link 
        rel="icon" 
        href="<%=logo_PerguruanTinggi%>" 
        type="image/x-icon"
    >
    <link 
        rel="shortcut icon" 
        href="<%=logo_PerguruanTinggi%>" 
        type="image/x-icon"
    >
    
    <link 
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" 
        rel="stylesheet"
    >
    <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    >
    
    <!-- MENGIMPOR TEMA GENERAL -->
    <link href="<%=request.getContextPath() %>/css/baru/base-theme.css?v=<%= cacheBuster %>" rel="stylesheet">

    <style>
        /* Base HTML & Body Settings */
        html { scroll-behavior: smooth; }

        body {
            background-color: var(--secondary-color);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: var(--text-dark);
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            margin: 0;
            overflow-x: hidden;
        }

        /* Background Pattern Setup */
        .page-bg-<%=rnd%> { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100vw; 
            height: 100vh; 
            background: url('<%=Common.ROOT%>/img/pmb_bg.jpg') center/cover no-repeat; 
            opacity: 0.05; 
            z-index: -999; 
            pointer-events: none; 
        }

        /* Header Hero Section */
        .hero-section-<%=rnd%> { 
            background: var(--theme-gradient, linear-gradient(135deg, rgba(13, 110, 253, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%));
            color: white; 
            border-radius: 0 0 3rem 3rem; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.15); 
            position: relative; 
            z-index: 2; 
            padding: 3rem 0 8rem 0; 
        }
        .hero-section-<%=rnd%>::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: url('<%=Common.ROOT%>/img/pmb_bg.jpg') center/cover no-repeat;
            opacity: 0.15; mix-blend-mode: overlay; z-index: -1;
        }
        
        main { flex: 1; }

        /* Logo Configuration */
        .logo-img {
            height: 100px; 
            object-fit: contain; 
            margin-bottom: 1rem;
            filter: drop-shadow(0px 8px 16px rgba(0,0,0,0.3));
            background: rgba(255,255,255,0.95); 
            padding: 10px 20px; 
            border-radius: 12px;
        }

        /* Sticky Floating Navigation Bar (Smart Wrap - tanpa horizontal scrollbar) */
        .floating-nav-wrapper {
            position: sticky;
            top: 16px;
            z-index: 1050;
            display: flex;
            justify-content: center;
            margin-bottom: 2.8rem;
            padding: 0 12px;
            pointer-events: none;
        }
        .floating-nav {
            position: relative;
            width: min(1280px, 100%);
            max-width: calc(100vw - 48px);
            background: rgba(255, 255, 255, 0.94);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border-radius: 32px;
            padding: 12px 14px;
            box-shadow: 0 22px 55px rgba(15, 23, 42, 0.16);
            border: 1px solid rgba(226, 232, 240, 0.95);
            pointer-events: auto;
            display: block;
            overflow: visible;
            transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
        }
        .floating-nav::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            pointer-events: none;
            background:
                radial-gradient(circle at top left, rgba(59, 130, 246, 0.10), transparent 32%),
                radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.10), transparent 32%);
        }
        .floating-nav:hover {
            transform: translateY(-2px);
            box-shadow: 0 26px 70px rgba(15, 23, 42, 0.20);
            background: rgba(255, 255, 255, 0.98);
        }
        .landing-nav-list {
            position: relative;
            z-index: 1;
            width: 100%;
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: stretch;
            justify-content: center;
            gap: 8px;
            padding: 0;
            margin: 0;
        }
        .landing-nav-list .nav-item {
            display: flex;
            flex: 0 1 88px;
            min-width: 0;
        }
        .custom-nav-link {
            width: 100%;
            min-height: 58px;
            color: #334155 !important;
            background: rgba(248, 250, 252, 0.74);
            border: 1px solid rgba(226, 232, 240, 0.78);
            font-weight: 900;
            font-size: 0.66rem;
            line-height: 1.15;
            text-transform: uppercase;
            letter-spacing: 0.045rem;
            padding: 9px 7px !important;
            border-radius: 20px;
            transition: all 0.25s ease;
            margin: 0;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            text-align: center;
            white-space: normal;
        }
        .custom-nav-link i {
            margin: 0 !important;
            font-size: 1rem;
            line-height: 1;
            color: var(--theme-primary, #0d6efd);
            opacity: 0.9;
        }
        .custom-nav-link:hover, .custom-nav-link.active {
            background: var(--theme-gradient, linear-gradient(135deg, #0d6efd, #2563eb));
            color: #ffffff !important;
            border-color: rgba(255,255,255,0.35);
            box-shadow: 0 12px 24px rgba(37, 99, 235, 0.25);
            transform: translateY(-2px);
        }
        .custom-nav-link:hover i, .custom-nav-link.active i {
            color: #ffffff;
            opacity: 1;
        }
        .mobile-smart-nav {
            background: rgba(255,255,255,0.96) !important;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-radius: 24px;
            border: 1px solid rgba(226,232,240,.95);
            box-shadow: 0 18px 42px rgba(15,23,42,.13);
        }
        .mobile-smart-nav .navbar-brand {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: var(--theme-primary, #0d6efd) !important;
        }
        .mobile-smart-nav .navbar-collapse {
            max-height: 72vh;
            overflow-y: auto;
            padding: 8px 0 4px;
        }
        .mobile-smart-nav .nav-link {
            border-radius: 16px;
            padding: .75rem .85rem;
            margin: .18rem 0;
            background: #f8fafc;
            border: 1px solid #edf2f7;
            transition: all .22s ease;
        }
        .mobile-smart-nav .nav-link:hover {
            background: #eff6ff;
            color: var(--theme-primary, #0d6efd) !important;
            transform: translateX(3px);
        }
        @media (min-width: 1400px) {
            .landing-nav-list .nav-item { flex-basis: 92px; }
            .custom-nav-link { font-size: 0.68rem; }
        }
        @media (max-width: 1199.98px) {
            .floating-nav { max-width: calc(100vw - 36px); }
            .landing-nav-list .nav-item { flex-basis: 94px; }
        }
        
        #section-intro, #section-executive, #section-portal, #section-products, #section-value, #section-harga, #section-spi, #section-impact, #section-roadmap, #section-about, #section-payment, #section-hardware, #section-modules, #section-daftar { scroll-margin-top: 110px; }

        /* Main Menu Portal Panel */
        .menu-panel {
            background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(15px);
            border-radius: 20px; padding: 2.5rem 1.5rem; box-shadow: 0 15px 40px rgba(0,0,0,0.08);
            border: 1px solid rgba(255, 255, 255, 0.8); 
        }

        .btn-custom-group { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 1.5rem; }
        .btn { 
            border-radius: 8px; font-weight: 600; padding: 10px 18px; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; align-items: center; justify-content: center; gap: 6px; 
            text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;
        }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 6px 15px rgba(0,0,0,0.15); }

        .section-title { 
            font-size: 1.15rem; font-weight: 800; color: var(--text-dark); margin-bottom: 1rem; 
            text-transform: uppercase; letter-spacing: 1px; position: relative; display: inline-block; 
        }
        .section-title::after { 
            content: ""; position: absolute; width: 50%; height: 3px; 
            background: var(--theme-gradient, linear-gradient(90deg, #0d6efd, #38bdf8));
            bottom: -6px; left: 25%; border-radius: 4px; 
        }

        /* Kotak Glassmorphism */
        .glass-intro {
            background: linear-gradient(to right, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
            backdrop-filter: blur(15px); border: 1px solid rgba(226, 232, 240, 0.8);
            border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.08);
            transition: transform 0.3s ease; position: relative; z-index: 15; overflow: hidden;
        }
        .glass-intro::before {
            content: ""; position: absolute; top: 0; left: 0; width: 6px; height: 100%;
            background: var(--theme-gradient, linear-gradient(to bottom, #0d6efd, #38bdf8));
        }
        .glass-intro:hover { transform: translateY(-3px); box-shadow: 0 25px 60px rgba(0,0,0,0.12); }

        /* Highlight Box CTA in Intro */
        .highlight-cta {
            background: var(--theme-gradient, linear-gradient(135deg, #0d6efd 0%, #38bdf8 100%));
            color: white; border-radius: 12px; padding: 1.5rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15); text-align: center; position: relative; overflow: hidden;
        }
        .highlight-cta h4 { font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.5rem; text-transform: uppercase; }

        /* Grid Cards Fitur */
        .feature-card {
            background: #ffffff; border: 1px solid #f1f5f9; border-radius: 16px;
            padding: 1.5rem; height: 100%; transition: all 0.4s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.03); text-align: left;
            display: flex; flex-direction: column; position: relative; overflow: hidden;
        }
        .feature-card::before {
            content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 4px;
            background: var(--theme-gradient, linear-gradient(90deg, #0d6efd, #38bdf8));
            transform: scaleX(0); transform-origin: left; transition: transform 0.4s ease;
        }
        .feature-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
        .feature-card:hover::before { transform: scaleX(1); }

        .feature-title { font-size: 1.15rem; font-weight: 800; color: var(--text-dark); margin-bottom: 1rem; margin-top: 1.5rem; display: flex; align-items: center; }
        .feature-title i { color: var(--theme-primary, #0d6efd); background: #eff6ff; padding: 10px; border-radius: 8px; margin-right: 10px; font-size: 1.2rem; }
        .feature-text { font-size: 0.95rem; color: var(--text-muted); line-height: 1.7; margin-bottom: 0; flex-grow: 1; text-align: justify; }

        /* Wrapper Video YouTube */
        .video-wrapper {
            border-radius: 12px; overflow: hidden; background-color: #cbd5e1;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;
        }
        .video-wrapper iframe { transition: transform 0.3s ease; }
        .video-wrapper:hover iframe { transform: scale(1.02); }

        /* Hover Zoom Gambar */
        .hover-zoom { transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer; }
        .hover-zoom:hover { transform: scale(1.03); box-shadow: 0 10px 20px rgba(0,0,0,0.15) !important; }

        /* CTA Section Bottom */
        .cta-section {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: white; padding: 5rem 2rem; border-radius: 24px; margin-bottom: 5rem;
            box-shadow: 0 20px 50px rgba(0,0,0,0.2); position: relative; overflow: hidden;
        }
        .cta-section::after {
            content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%); pointer-events: none;
        }

        /* Contact Box */
        .contact-box {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(10px); border-radius: 16px; padding: 2rem 1.5rem; text-align: center; height: 100%;
            transition: all 0.3s ease; display: flex; flex-direction: column; justify-content: flex-start; align-items: center;
        }
        .contact-box:hover { background: rgba(255,255,255,0.1); transform: translateY(-5px); }
        .contact-box h5 { color: var(--theme-text-on-primary, #38bdf8); font-weight: 700; margin-bottom: 0.5rem; font-size: 1.1rem; line-height: 1.4; }
        .contact-box .role-desc { color: #cbd5e1; font-size: 0.85rem; line-height: 1.5; text-align: center; margin-bottom: 1.5rem; flex-grow: 1; }
        .contact-box .wa-link-container { margin-top: auto; }

        /* Footer */
        .footer-custom { background-color: #0f172a; color: #94a3b8; padding-top: 5rem; padding-bottom: 2rem; margin-top: auto; }
        .footer-custom h5 { color: #e2e8f0; font-weight: 800; letter-spacing: 1px; margin-bottom: 1.5rem; }
        .footer-link { text-decoration: none; color: #94a3b8; transition: color 0.3s ease; }
        .footer-link:hover { color: var(--theme-primary, #38bdf8); }
        .store-icon { height: 32px; margin-right: 10px; transition: transform 0.3s ease; }
        .store-icon:hover { transform: scale(1.1); }
        .contact-icon { color: var(--theme-primary, #38bdf8); width: 24px; text-align: center; }


        /* =====================================================================================
           ENHANCED LANDING PAGE UI - Enterprise Education Premium Look
           ===================================================================================== */
        :root {
            --ee-primary: var(--theme-primary, var(--primary-color, #2563eb));
            --ee-primary-dark: #1e3a8a;
            --ee-accent: #38bdf8;
            --ee-gold: #f59e0b;
            --ee-success: #10b981;
            --ee-dark: #0f172a;
            --ee-soft: #f8fafc;
            --ee-border: rgba(148, 163, 184, 0.22);
            --ee-card-shadow: 0 20px 55px rgba(15, 23, 42, 0.10);
        }

        .hero-section-<%=rnd%> {
            overflow: hidden;
            padding: 3rem 0 9rem 0;
        }
        .hero-section-<%=rnd%>::after {
            content: "";
            position: absolute;
            width: 540px;
            height: 540px;
            right: -160px;
            top: -180px;
            background: radial-gradient(circle, rgba(56,189,248,0.40), rgba(37,99,235,0.18), transparent 68%);
            filter: blur(2px);
            z-index: -1;
        }
        .hero-orb-left {
            position: absolute;
            width: 360px;
            height: 360px;
            left: -140px;
            bottom: -160px;
            background: radial-gradient(circle, rgba(245,158,11,0.32), rgba(255,255,255,0.08), transparent 70%);
            pointer-events: none;
        }
        .hero-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.28);
            background: rgba(255,255,255,0.14);
            color: #e0f2fe;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-size: 0.78rem;
            box-shadow: 0 12px 28px rgba(15,23,42,0.12);
            backdrop-filter: blur(12px);
        }
        .hero-title-modern {
            max-width: 980px;
            margin: 18px auto 0 auto;
            font-size: 3.55rem;
            line-height: 1.05;
            letter-spacing: -0.06em;
            font-weight: 900;
            color: #ffffff;
            text-shadow: 0 12px 28px rgba(15,23,42,0.28);
        }
        .hero-title-modern .text-gradient-soft {
            color: #fde68a;
        }
        .hero-subtitle-modern {
            max-width: 900px;
            margin: 22px auto 0 auto;
            color: rgba(255,255,255,0.84);
            font-size: 1.18rem;
            line-height: 1.85;
            font-weight: 400;
        }
        .hero-cta-group {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 28px;
        }
        .btn-hero-primary, .btn-hero-outline {
            min-width: 210px;
            border-radius: 999px !important;
            padding: 13px 24px !important;
            font-weight: 800 !important;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .btn-hero-primary {
            background: #ffffff !important;
            color: var(--ee-primary-dark) !important;
            border: 1px solid rgba(255,255,255,0.90) !important;
            box-shadow: 0 16px 32px rgba(15,23,42,0.22) !important;
        }
        .btn-hero-outline {
            background: rgba(255,255,255,0.10) !important;
            color: #ffffff !important;
            border: 1px solid rgba(255,255,255,0.34) !important;
            backdrop-filter: blur(12px);
        }
        .hero-trust-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            max-width: 960px;
            margin: 34px auto 0 auto;
        }
        .hero-trust-item {
            background: rgba(255,255,255,0.13);
            border: 1px solid rgba(255,255,255,0.22);
            border-radius: 18px;
            padding: 15px 16px;
            color: #ffffff;
            text-align: left;
            backdrop-filter: blur(12px);
            box-shadow: 0 14px 30px rgba(15,23,42,0.13);
        }
        .hero-trust-item i {
            width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: rgba(255,255,255,0.18);
            color: #fde68a;
            margin-bottom: 10px;
        }
        .hero-trust-item strong {
            display: block;
            font-size: 0.94rem;
            line-height: 1.35;
        }
        .hero-trust-item span {
            display: block;
            margin-top: 4px;
            color: rgba(255,255,255,0.76);
            font-size: 0.82rem;
            line-height: 1.45;
        }
        .client-pill-premium {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            border-radius: 999px;
            background: rgba(255,255,255,0.92);
            color: var(--ee-primary-dark);
            font-weight: 900;
            box-shadow: 0 14px 32px rgba(15,23,42,0.18);
        }
        .present-box-premium {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            color: rgba(255,255,255,0.84);
            font-size: 0.96rem;
        }
        .section-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            border-radius: 999px;
            background: rgba(37,99,235,0.09);
            color: var(--ee-primary);
            font-size: 0.78rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 12px;
        }
        .section-heading-premium {
            font-size: 2.35rem;
            line-height: 1.12;
            letter-spacing: -0.04em;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 14px;
        }
        .section-lead-premium {
            color: #64748b;
            font-size: 1.04rem;
            line-height: 1.85;
            max-width: 870px;
            margin-left: auto;
            margin-right: auto;
        }
        .premium-card {
            background: rgba(255,255,255,0.94);
            border: 1px solid var(--ee-border);
            border-radius: 24px;
            box-shadow: var(--ee-card-shadow);
            position: relative;
            overflow: hidden;
        }
        .premium-card::before {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top right, rgba(56,189,248,0.14), transparent 42%);
            pointer-events: none;
        }
        .benefit-card {
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.92);
            border-radius: 22px;
            padding: 24px;
            height: 100%;
            box-shadow: 0 10px 30px rgba(15,23,42,0.055);
            transition: all 0.35s ease;
            text-align: left;
            position: relative;
            overflow: hidden;
        }
        .benefit-card:hover {
            transform: translateY(-7px);
            box-shadow: 0 22px 45px rgba(15,23,42,0.10);
            border-color: rgba(37,99,235,0.32);
        }
        .benefit-icon {
            width: 54px;
            height: 54px;
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            background: linear-gradient(135deg, var(--ee-primary), var(--ee-accent));
            box-shadow: 0 12px 24px rgba(37,99,235,0.22);
            font-size: 1.25rem;
            margin-bottom: 18px;
        }
        .benefit-card h4 {
            font-size: 1.08rem;
            line-height: 1.35;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 10px;
        }
        .benefit-card p {
            color: #64748b;
            line-height: 1.75;
            font-size: 0.94rem;
            margin-bottom: 0;
            text-align: justify;
        }
        .pain-solution-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
        }
        .comparison-box {
            border-radius: 22px;
            padding: 24px;
            height: 100%;
            text-align: left;
        }
        .comparison-box.problem {
            background: linear-gradient(135deg, #fff7ed, #ffffff);
            border: 1px solid rgba(249,115,22,0.18);
        }
        .comparison-box.solution {
            background: linear-gradient(135deg, #ecfdf5, #ffffff);
            border: 1px solid rgba(16,185,129,0.20);
        }
        .comparison-box h4 {
            font-weight: 900;
            margin-bottom: 16px;
            color: #0f172a;
        }
        .check-list-modern, .x-list-modern {
            list-style: none;
            padding-left: 0;
            margin-bottom: 0;
        }
        .check-list-modern li, .x-list-modern li {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            line-height: 1.65;
            margin-bottom: 12px;
            color: #475569;
            font-size: 0.95rem;
        }
        .check-list-modern li i {
            color: #10b981;
            margin-top: 4px;
        }
        .x-list-modern li i {
            color: #f97316;
            margin-top: 4px;
        }
        .roadmap-step {
            position: relative;
            padding: 22px;
            border-radius: 22px;
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.92);
            box-shadow: 0 10px 26px rgba(15,23,42,0.055);
            height: 100%;
            text-align: left;
        }
        .roadmap-number {
            width: 42px;
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
            color: #ffffff;
            background: linear-gradient(135deg, var(--ee-primary), var(--ee-accent));
            font-weight: 900;
            margin-bottom: 14px;
        }
        .roadmap-step h5 {
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 9px;
        }
        .roadmap-step p {
            color: #64748b;
            line-height: 1.65;
            font-size: 0.93rem;
            margin-bottom: 0;
        }
        .platform-strip {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-top: 26px;
        }
        .platform-item {
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.88);
            border-radius: 20px;
            padding: 20px;
            text-align: left;
            box-shadow: 0 12px 30px rgba(15,23,42,0.055);
        }
        .platform-item i {
            color: var(--ee-primary);
            font-size: 1.4rem;
            margin-bottom: 12px;
        }
        .platform-item strong {
            display: block;
            color: #0f172a;
            font-weight: 900;
            margin-bottom: 6px;
        }
        .platform-item span {
            display: block;
            color: #64748b;
            font-size: 0.9rem;
            line-height: 1.55;
        }
        .sticky-cta-floating {
            position: fixed;
            right: 20px;
            bottom: 90px /* ditumpuk di atas tombol Bantuan agar tak bertindih */;
            z-index: 1060;
            display: flex;
            align-items: center;
            gap: 10px;
            border-radius: 999px;
            padding: 12px 18px;
            color: #ffffff !important;
            text-decoration: none;
            background: linear-gradient(135deg, #16a34a, #22c55e);
            box-shadow: 0 18px 35px rgba(22,163,74,0.32);
            font-weight: 900;
            letter-spacing: 0.02em;
        }
        .sticky-cta-floating:hover {
            transform: translateY(-3px);
            color: #ffffff !important;
        }
        .menu-panel {
            border-radius: 28px;
            box-shadow: 0 28px 70px rgba(15,23,42,0.12);
        }
        .btn-custom-group .btn {
            border-radius: 999px;
        }

        .portal-group-section {
            position: relative;
            padding: 1.18rem 1.05rem 1.05rem;
            border-radius: 24px;
            background:
                radial-gradient(circle at top right, rgba(59,130,246,0.08), transparent 34%),
                linear-gradient(135deg, rgba(255,255,255,0.82), rgba(248,250,252,0.94));
            border: 1px solid rgba(226,232,240,0.92);
            box-shadow: 0 16px 38px rgba(15,23,42,0.06);
            transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .portal-group-section:hover {
            transform: translateY(-2px);
            box-shadow: 0 22px 50px rgba(15,23,42,0.09);
            border-color: rgba(191,219,254,0.98);
        }
        .portal-group-section .section-title {
            margin-bottom: .9rem;
        }
        .portal-group-section + hr {
            margin-top: 1.45rem !important;
            margin-bottom: 1.45rem !important;
        }
        .portal-group-section.group-campus .portal-support-copy i {
            background: linear-gradient(135deg, #1d4ed8, #38bdf8);
        }
        .portal-group-section.group-school .portal-support-copy i {
            background: linear-gradient(135deg, #111827, #64748b);
            box-shadow: 0 14px 26px rgba(17,24,39,0.22);
        }
        .portal-group-section.group-docs .portal-support-copy i {
            background: linear-gradient(135deg, #b91c1c, #f97316);
            box-shadow: 0 14px 26px rgba(185,28,28,0.22);
        }
        .portal-group-section.group-support .portal-support-copy i {
            background: linear-gradient(135deg, #0f766e, #2563eb);
            box-shadow: 0 14px 26px rgba(37,99,235,0.22);
        }
        .portal-mini-label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin: .1rem auto .55rem;
            padding: 6px 11px;
            border-radius: 999px;
            font-size: .72rem;
            font-weight: 900;
            letter-spacing: .05em;
            text-transform: uppercase;
            color: #475569;
            background: #ffffff;
            border: 1px solid rgba(226,232,240,.95);
            box-shadow: 0 8px 20px rgba(15,23,42,.05);
        }
        .portal-action-grid .btn-danger,
        .portal-action-grid .btn-dark,
        .portal-action-grid .btn-primary,
        .portal-action-grid .btn-success {
            color: #ffffff !important;
        }
        .portal-action-grid .btn-outline-dark:hover,
        .portal-action-grid .btn-outline-success:hover,
        .portal-action-grid .btn-outline-primary:hover {
            color: #ffffff !important;
        }

        .portal-support-copy {
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 13px 16px;
            border-radius: 20px;
            background:
                radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 38%),
                linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98));
            border: 1px solid rgba(226, 232, 240, 0.96);
            box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
            max-width: 940px;
            margin: 0 auto .95rem;
            text-align: left;
        }
        .portal-support-copy i {
            flex: 0 0 auto;
            width: 38px;
            height: 38px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            background: var(--theme-gradient, linear-gradient(135deg, #0d6efd, #2563eb));
            box-shadow: 0 14px 26px rgba(37, 99, 235, 0.28);
        }
        .portal-support-copy strong {
            display: block;
            color: #0f172a;
            font-weight: 900;
            margin-bottom: 4px;
        }
        .portal-support-copy span {
            display: block;
            color: #64748b;
            font-size: 0.88rem;
            line-height: 1.58;
        }
        .portal-action-grid {
            align-items: stretch;
            gap: 9px;
        }
        .portal-action-grid .btn {
            position: relative;
            overflow: hidden;
            flex: 1 1 170px;
            min-height: 56px;
            justify-content: flex-start;
            text-align: left;
            padding: 10px 12px;
            border-radius: 16px !important;
            text-transform: none;
            letter-spacing: 0.005em;
            font-size: 0.84rem;
            line-height: 1.18;
            box-shadow: 0 10px 22px rgba(15, 23, 42, 0.09) !important;
        }
        .portal-action-grid .btn::after {
            content: "";
            position: absolute;
            top: -45%;
            right: -22%;
            width: 70px;
            height: 70px;
            border-radius: 999px;
            background: rgba(255,255,255,0.17);
            transition: transform .28s ease, opacity .28s ease;
        }
        .portal-action-grid .btn:hover::after {
            transform: scale(1.28);
            opacity: .9;
        }
        .portal-action-grid .btn i {
            flex: 0 0 auto;
            width: 30px;
            height: 30px;
            border-radius: 12px;
            font-size: .82rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.20);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16);
        }
        .portal-action-grid .btn-outline-primary i,
        .portal-action-grid .btn-outline-success i,
        .portal-action-grid .btn-outline-dark i {
            background: rgba(37, 99, 235, 0.08);
            color: inherit;
        }
        .portal-btn-featured {
            border: 0 !important;
            background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 52%, #06b6d4 100%) !important;
            color: #ffffff !important;
        }
        .portal-btn-featured:hover {
            color: #ffffff !important;
            box-shadow: 0 18px 40px rgba(37, 99, 235, 0.28) !important;
        }
        .portal-support-note {
            max-width: 1040px;
            margin: .85rem auto 0;
            padding: 10px 14px;
            border-radius: 16px;
            color: #475569;
            background: linear-gradient(135deg, rgba(239,246,255,0.96), rgba(240,253,250,0.92));
            border: 1px solid rgba(191,219,254,0.92);
            font-size: 0.86rem;
            line-height: 1.55;
        }
        .portal-support-note i {
            color: var(--theme-primary, #0d6efd);
        }
        @media (min-width: 992px) {
            .portal-action-grid .btn {
                max-width: 210px;
            }
            .portal-group-section.group-docs .portal-action-grid .btn {
                max-width: 230px;
            }
        }
        @media (min-width: 1200px) {
            .portal-action-grid .btn {
                flex-basis: 176px;
            }
        }
        @media (max-width: 575.98px) {
            .portal-support-copy {
                flex-direction: column;
                text-align: center;
                align-items: center;
            }
            .portal-action-grid .btn {
                flex-basis: 100%;
                justify-content: center;
                text-align: center;
            }
        }
        .feature-card {
            border-radius: 24px;
        }
        .feature-card .video-wrapper {
            border-radius: 18px;
        }
        .cta-section {
            border-radius: 34px;
            background: radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 32%), linear-gradient(135deg, #0f172a 0%, #172554 52%, #0f172a 100%);
        }


        /* Enhanced Formal Landing Sections - Integrasi Proposal, Penawaran, Presentasi, dan PKS */
        .enterprise-ribbon-v2 {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(13,110,253,0.10), rgba(56,189,248,0.14));
            color: var(--theme-primary, #0d6efd);
            font-weight: 900;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08rem;
            border: 1px solid rgba(37, 99, 235, 0.16);
            margin-bottom: 1rem;
        }
        .executive-brief-card {
            position: relative;
            overflow: hidden;
            background:
                radial-gradient(circle at top right, rgba(56,189,248,0.16), transparent 34%),
                linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 24px;
            padding: 1.65rem;
            height: 100%;
            text-align: left;
            box-shadow: 0 16px 38px rgba(15, 23, 42, 0.055);
            transition: all .35s ease;
        }
        .executive-brief-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 24px 52px rgba(15, 23, 42, 0.10);
            border-color: rgba(37, 99, 235, 0.22);
        }
        .executive-icon {
            width: 52px;
            height: 52px;
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            background: var(--theme-gradient, linear-gradient(135deg, #0d6efd, #38bdf8));
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.24);
            font-size: 1.3rem;
            margin-bottom: 1.1rem;
        }
        .executive-brief-card h4,
        .partnership-card h4,
        .investment-card h4,
        .document-action-card h4 {
            font-size: 1.05rem;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: .75rem;
            line-height: 1.38;
        }
        .executive-brief-card p,
        .partnership-card p,
        .investment-card p,
        .document-action-card p {
            color: #64748b;
            font-size: .96rem;
            line-height: 1.75;
            margin-bottom: 0;
            text-align: justify;
        }
        .formal-note-box {
            border-radius: 24px;
            padding: 1.4rem 1.6rem;
            background: linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.93));
            color: #ffffff;
            box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
            position: relative;
            overflow: hidden;
            text-align: left;
        }
        .formal-note-box::after {
            content: "";
            position: absolute;
            right: -42px;
            bottom: -42px;
            width: 150px;
            height: 150px;
            border-radius: 999px;
            background: rgba(255,255,255,0.08);
        }
        .formal-note-box .note-title {
            font-size: 1.12rem;
            font-weight: 900;
            margin-bottom: .55rem;
        }
        .formal-note-box .note-text {
            color: #dbeafe;
            line-height: 1.75;
            margin-bottom: 0;
            position: relative;
            z-index: 2;
        }
        .deliverable-strip {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-top: 1.4rem;
        }
        .deliverable-item {
            border-radius: 18px;
            padding: 1rem;
            background: rgba(255,255,255,0.92);
            border: 1px solid rgba(226,232,240,0.95);
            text-align: left;
            box-shadow: 0 10px 26px rgba(15,23,42,0.04);
        }
        .deliverable-item i {
            color: var(--theme-primary, #0d6efd);
            margin-right: 8px;
        }
        .deliverable-item strong {
            display: block;
            color: #0f172a;
            font-size: .92rem;
            margin-bottom: .25rem;
        }
        .deliverable-item span {
            display: block;
            color: #64748b;
            font-size: .84rem;
            line-height: 1.55;
        }
        .partnership-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
        }
        .partnership-card {
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.95);
            border-radius: 22px;
            padding: 1.45rem;
            height: 100%;
            text-align: left;
            box-shadow: 0 14px 34px rgba(15,23,42,0.05);
            transition: all .35s ease;
        }
        .partnership-card:hover { transform: translateY(-5px); box-shadow: 0 22px 48px rgba(15,23,42,0.09); }
        .partnership-card .badge-soft {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 11px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: .74rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .06rem;
            margin-bottom: .95rem;
        }
        .success-table-modern {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            overflow: hidden;
            border-radius: 18px;
            border: 1px solid rgba(226,232,240,0.95);
            background: #ffffff;
            box-shadow: 0 14px 34px rgba(15,23,42,0.04);
            text-align: left;
        }
        .success-table-modern th {
            background: linear-gradient(135deg, #0f172a, #1d4ed8);
            color: #ffffff;
            padding: 14px 16px;
            font-size: .86rem;
            text-transform: uppercase;
            letter-spacing: .06rem;
        }
        .success-table-modern td {
            padding: 14px 16px;
            color: #475569;
            border-top: 1px solid #e2e8f0;
            vertical-align: top;
            line-height: 1.65;
            font-size: .94rem;
        }
        .success-table-modern td:first-child {
            color: #0f172a;
            font-weight: 900;
            width: 30%;
        }
        .investment-card {
            border-radius: 24px;
            padding: 1.55rem;
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.95);
            height: 100%;
            text-align: left;
            box-shadow: 0 16px 38px rgba(15,23,42,0.055);
            position: relative;
            overflow: hidden;
        }
        .investment-card::before {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 5px;
            background: var(--theme-gradient, linear-gradient(90deg, #0d6efd, #38bdf8));
        }
        .investment-tag {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #334155;
            font-size: .78rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .05rem;
            margin-bottom: .9rem;
        }
        .investment-list {
            list-style: none;
            padding: 0;
            margin: 1rem 0 0;
        }
        .investment-list li {
            display: flex;
            gap: 10px;
            color: #475569;
            font-size: .93rem;
            line-height: 1.62;
            padding: .42rem 0;
            border-top: 1px dashed #e2e8f0;
        }
        .investment-list li:first-child { border-top: 0; }
        .investment-list i { color: #16a34a; margin-top: 4px; }
        .document-center-panel {
            background:
                radial-gradient(circle at top left, rgba(59,130,246,0.13), transparent 34%),
                radial-gradient(circle at bottom right, rgba(245,158,11,0.13), transparent 34%),
                #ffffff;
            border: 1px solid rgba(226,232,240,0.95);
            border-radius: 28px;
            padding: 2rem;
            box-shadow: 0 22px 56px rgba(15,23,42,0.08);
        }
        .document-action-card {
            background: rgba(255,255,255,0.96);
            border: 1px solid rgba(226,232,240,0.95);
            border-radius: 22px;
            padding: 1.4rem;
            height: 100%;
            text-align: left;
            box-shadow: 0 14px 32px rgba(15,23,42,0.05);
        }
        .document-action-card .doc-icon {
            width: 46px;
            height: 46px;
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            background: linear-gradient(135deg, #dc2626, #f97316);
            box-shadow: 0 12px 26px rgba(220,38,38,.18);
            margin-bottom: 1rem;
        }
        .document-action-card .btn {
            margin-top: 1.1rem;
            width: 100%;
            justify-content: center;
        }
        .legal-footnote {
            border-radius: 18px;
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
            padding: 1rem 1.2rem;
            text-align: left;
            line-height: 1.65;
            font-size: .92rem;
        }
        @media (max-width: 991.98px) {
            .deliverable-strip,
            .partnership-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 575.98px) {
            .deliverable-strip,
            .partnership-grid { grid-template-columns: 1fr; }
            .success-table-modern { font-size: .86rem; }
            .success-table-modern th, .success-table-modern td { padding: 12px; }
        }

        @media (max-width: 991.98px) {
            .hero-title-modern { font-size: 2.35rem; }
            .hero-subtitle-modern { font-size: 1.02rem; }
            .hero-trust-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .pain-solution-row { grid-template-columns: 1fr; }
            .platform-strip { grid-template-columns: 1fr; }
            .sticky-cta-floating span { display: none; }
            .sticky-cta-floating { padding: 14px 16px; }
        }
        @media (max-width: 575.98px) {
            .hero-title-modern { font-size: 2rem; }
            .hero-trust-grid { grid-template-columns: 1fr; }
            .section-heading-premium { font-size: 1.75rem; }
        }


        /* EXTRA COMPACT PORTAL BUTTONS - membuat tombol portal lebih ringan, rapi, dan tidak terlalu mendominasi halaman */
        .portal-group-section {
            padding: 1rem .95rem .95rem;
        }
        .portal-action-grid {
            gap: 7px;
            justify-content: center;
        }
        .portal-action-grid .btn {
            flex: 0 1 146px;
            max-width: 164px;
            min-height: 44px;
            padding: 7px 10px;
            border-radius: 13px !important;
            font-size: 0.75rem;
            line-height: 1.12;
            gap: 7px;
            box-shadow: 0 7px 16px rgba(15, 23, 42, 0.075) !important;
        }
        .portal-action-grid .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 11px 22px rgba(15, 23, 42, 0.11) !important;
        }
        .portal-action-grid .btn i {
            width: 24px;
            height: 24px;
            border-radius: 9px;
            font-size: .68rem;
        }
        .portal-action-grid .btn::after {
            width: 52px;
            height: 52px;
            top: -42%;
            right: -24%;
            opacity: .72;
        }
        .portal-mini-label {
            padding: 5px 10px;
            font-size: .68rem;
            margin-bottom: .45rem;
        }
        .portal-support-note {
            margin-top: .65rem;
            padding: 8px 12px;
            font-size: .8rem;
            border-radius: 14px;
        }
        @media (min-width: 992px) {
            .portal-action-grid .btn {
                max-width: 164px;
            }
            .portal-group-section.group-docs .portal-action-grid .btn {
                max-width: 176px;
            }
        }
        @media (min-width: 1200px) {
            .portal-action-grid .btn {
                flex-basis: 148px;
            }
        }
        @media (max-width: 575.98px) {
            .portal-action-grid .btn {
                flex: 1 1 calc(50% - 8px);
                max-width: none;
                min-height: 46px;
                justify-content: center;
                text-align: center;
                font-size: .74rem;
                padding: 8px 8px;
            }
            .portal-action-grid .btn i {
                width: 23px;
                height: 23px;
            }
        }


        /* HOVER CONTRAST FIX - menjaga teks tombol portal tetap terbaca saat mouse diarahkan */
        .portal-action-grid .btn,
        .portal-action-grid .btn:hover,
        .portal-action-grid .btn:focus,
        .portal-action-grid .btn:active {
            text-decoration: none !important;
            -webkit-text-fill-color: currentColor;
        }
        .portal-action-grid .btn.btn-primary,
        .portal-action-grid .btn.btn-success,
        .portal-action-grid .btn.btn-dark,
        .portal-action-grid .btn.btn-danger,
        .portal-action-grid .btn.portal-btn-featured {
            color: #ffffff !important;
            border-color: transparent !important;
        }
        .portal-action-grid .btn.btn-primary:hover,
        .portal-action-grid .btn.btn-primary:focus,
        .portal-action-grid .btn.btn-primary:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #123f91 0%, #1d4ed8 48%, #0ea5e9 100%) !important;
            border-color: rgba(255,255,255,0.18) !important;
        }
        .portal-action-grid .btn.btn-success:hover,
        .portal-action-grid .btn.btn-success:focus,
        .portal-action-grid .btn.btn-success:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #047857 0%, #16a34a 55%, #22c55e 100%) !important;
            border-color: rgba(255,255,255,0.18) !important;
        }
        .portal-action-grid .btn.btn-dark:hover,
        .portal-action-grid .btn.btn-dark:focus,
        .portal-action-grid .btn.btn-dark:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #020617 0%, #1e293b 55%, #334155 100%) !important;
            border-color: rgba(255,255,255,0.18) !important;
        }
        .portal-action-grid .btn.btn-danger:hover,
        .portal-action-grid .btn.btn-danger:focus,
        .portal-action-grid .btn.btn-danger:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #991b1b 0%, #dc2626 55%, #f97316 100%) !important;
            border-color: rgba(255,255,255,0.18) !important;
        }
        .portal-action-grid .btn.portal-btn-featured:hover,
        .portal-action-grid .btn.portal-btn-featured:focus,
        .portal-action-grid .btn.portal-btn-featured:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 52%, #06b6d4 100%) !important;
            border-color: rgba(255,255,255,0.18) !important;
        }
        .portal-action-grid .btn.btn-outline-primary {
            color: #1d4ed8 !important;
            background-color: #ffffff !important;
            border-color: rgba(37, 99, 235, 0.38) !important;
        }
        .portal-action-grid .btn.btn-outline-success {
            color: #047857 !important;
            background-color: #ffffff !important;
            border-color: rgba(16, 185, 129, 0.42) !important;
        }
        .portal-action-grid .btn.btn-outline-dark {
            color: #111827 !important;
            background-color: #ffffff !important;
            border-color: rgba(15, 23, 42, 0.34) !important;
        }
        .portal-action-grid .btn.btn-outline-primary:hover,
        .portal-action-grid .btn.btn-outline-primary:focus,
        .portal-action-grid .btn.btn-outline-primary:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 58%, #38bdf8 100%) !important;
            border-color: transparent !important;
        }
        .portal-action-grid .btn.btn-outline-success:hover,
        .portal-action-grid .btn.btn-outline-success:focus,
        .portal-action-grid .btn.btn-outline-success:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #047857 0%, #16a34a 58%, #34d399 100%) !important;
            border-color: transparent !important;
        }
        .portal-action-grid .btn.btn-outline-dark:hover,
        .portal-action-grid .btn.btn-outline-dark:focus,
        .portal-action-grid .btn.btn-outline-dark:active {
            color: #ffffff !important;
            background: linear-gradient(135deg, #020617 0%, #111827 58%, #475569 100%) !important;
            border-color: transparent !important;
        }
        .portal-action-grid .btn:hover i,
        .portal-action-grid .btn:focus i,
        .portal-action-grid .btn:active i {
            color: #ffffff !important;
            background: rgba(255,255,255,0.24) !important;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22), 0 6px 12px rgba(15,23,42,0.12) !important;
        }
        .portal-action-grid .btn:hover::after,
        .portal-action-grid .btn:focus::after,
        .portal-action-grid .btn:active::after {
            opacity: .95;
        }

        /* ===== Narasi Produk (eCampus / eSchool / eMedic / ePesantren) ===== */
        .ee-prod-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(285px, 1fr));
            gap: 1.4rem;
            margin-top: 1.9rem;
        }
        .ee-prod-card {
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.92);
            border-radius: 22px;
            padding: 26px 24px 24px;
            height: 100%;
            box-shadow: 0 10px 30px rgba(15,23,42,0.055);
            transition: all 0.35s ease;
            position: relative;
            overflow: hidden;
        }
        .ee-prod-card:hover {
            transform: translateY(-7px);
            box-shadow: 0 22px 45px rgba(15,23,42,0.10);
            border-color: rgba(37,99,235,0.32);
        }
        .ee-prod-badge {
            width: 54px; height: 54px;
            border-radius: 16px;
            display: inline-flex; align-items: center; justify-content: center;
            color: #ffffff; font-size: 1.25rem;
            box-shadow: 0 12px 24px rgba(15,23,42,0.16);
            margin-bottom: 16px;
        }
        .ee-prod-card h4 {
            font-weight: 800; font-size: 1.22rem;
            color: var(--ee-dark); margin-bottom: 2px;
        }
        .ee-prod-for {
            display: block; font-size: 0.8rem; font-weight: 700;
            letter-spacing: 0.03em; text-transform: uppercase; margin-bottom: 12px;
        }
        .ee-prod-card p {
            font-size: 0.94rem; line-height: 1.78;
            color: #475569; margin-bottom: 14px;
        }
        .ee-prod-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .ee-prod-chips span {
            font-size: 0.74rem; font-weight: 600; color: #334155;
            background: #f1f5f9; border: 1px solid rgba(226,232,240,0.95);
            border-radius: 999px; padding: 3px 10px;
        }
        .ee-prod-foot {
            margin-top: 1.9rem; padding: 18px 20px; border-radius: 18px;
            background: rgba(37,99,235,0.06);
            border: 1px solid rgba(37,99,235,0.16);
            font-size: 0.95rem; line-height: 1.75; color: #1e3a8a;
        }

        /* ===== Kecerdasan Buatan ===== */
        .ee-ai-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(258px, 1fr));
            gap: 1.25rem;
            margin-top: 1.9rem;
        }
        .ee-ai-pillar {
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.92);
            border-radius: 22px;
            padding: 24px;
            height: 100%;
            box-shadow: 0 10px 30px rgba(15,23,42,0.055);
            transition: all 0.35s ease;
        }
        .ee-ai-pillar:hover {
            transform: translateY(-7px);
            box-shadow: 0 22px 45px rgba(15,23,42,0.10);
            border-color: rgba(109,40,217,0.32);
        }
        .ee-ai-num {
            width: 40px; height: 40px; border-radius: 13px;
            display: inline-flex; align-items: center; justify-content: center;
            color: #ffffff; font-weight: 800; font-size: 0.98rem;
            background: linear-gradient(135deg, var(--ee-primary), #6d28d9);
            box-shadow: 0 12px 24px rgba(109,40,217,0.22);
            margin-bottom: 14px;
        }
        .ee-ai-pillar h5 {
            font-weight: 800; font-size: 1.06rem;
            color: var(--ee-dark); margin-bottom: 8px;
        }
        .ee-ai-pillar p {
            font-size: 0.92rem; line-height: 1.75; color: #475569; margin: 0;
        }
        .ee-ai-engine {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.25rem; margin-top: 1.5rem;
        }
        .ee-ai-box {
            border: 1px solid rgba(226,232,240,0.92);
            border-radius: 20px; padding: 22px; background: #ffffff;
        }
        .ee-ai-box.is-primary {
            border-color: rgba(16,185,129,0.42);
            background: linear-gradient(180deg, rgba(16,185,129,0.07), #ffffff);
        }
        .ee-ai-box h6 {
            font-weight: 800; font-size: 1.02rem;
            color: var(--ee-dark); margin-bottom: 8px;
        }
        .ee-ai-box p { font-size: 0.9rem; line-height: 1.75; color: #475569; margin: 0; }
        .ee-ai-note {
            margin-top: 1.5rem; padding: 18px 20px; border-radius: 18px;
            background: rgba(15,23,42,0.045);
            border: 1px solid rgba(148,163,184,0.28);
            font-size: 0.94rem; line-height: 1.78; color: #334155;
        }

        /* ===== Satuan Pengawasan Internal ===== */
        .ee-new-pill {
            display: inline-flex; align-items: center; gap: 6px;
            font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em;
            text-transform: uppercase; color: #ffffff;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-radius: 999px; padding: 4px 12px;
            box-shadow: 0 8px 18px rgba(217,119,6,0.28);
            margin-bottom: 14px;
        }
        .ee-spi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(258px, 1fr));
            gap: 1.25rem; margin-top: 1.9rem;
        }
        .ee-spi-card {
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.92);
            border-radius: 22px;
            padding: 24px; height: 100%;
            box-shadow: 0 10px 30px rgba(15,23,42,0.055);
            transition: all 0.35s ease;
        }
        .ee-spi-card:hover {
            transform: translateY(-7px);
            box-shadow: 0 22px 45px rgba(15,23,42,0.10);
            border-color: rgba(15,118,110,0.32);
        }
        .ee-spi-ic {
            width: 48px; height: 48px; border-radius: 15px;
            display: inline-flex; align-items: center; justify-content: center;
            color: #ffffff; font-size: 1.12rem;
            background: linear-gradient(135deg, #0f766e, #115e59);
            box-shadow: 0 12px 24px rgba(15,118,110,0.24);
            margin-bottom: 14px;
        }
        .ee-spi-card h5 {
            font-weight: 800; font-size: 1.05rem;
            color: var(--ee-dark); margin-bottom: 8px;
        }
        .ee-spi-card p { font-size: 0.92rem; line-height: 1.75; color: #475569; margin: 0; }
        .ee-spi-verticals {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem; margin-top: 1.6rem;
        }
        .ee-spi-vert {
            background: rgba(15,118,110,0.055);
            border: 1px solid rgba(15,118,110,0.16);
            border-radius: 18px; padding: 18px 20px;
        }
        .ee-spi-vert strong {
            display: block; font-size: 0.98rem; font-weight: 800;
            color: #115e59; margin-bottom: 6px;
        }
        .ee-spi-vert span { font-size: 0.88rem; line-height: 1.72; color: #475569; }
        .ee-spi-note {
            margin-top: 1.5rem; padding: 18px 20px; border-radius: 18px;
            background: rgba(109,40,217,0.06);
            border: 1px solid rgba(109,40,217,0.18);
            font-size: 0.94rem; line-height: 1.78; color: #4c1d95;
        }
    </style>
</head>
<body>
<jsp:include page="/WEB-INF/baru/include/pemilih_bahasa.jsp" />

    <div class="page-bg-<%=rnd%>"></div>

    <header class="hero-section-<%=rnd%> text-center">
        <div class="hero-orb-left"></div>
        <div class="container position-relative z-2">
            <img 
                src="<%=logo_PerguruanTinggi%>" 
                alt="<%= Common.getBahasaConfig("Logo Institusi Pendidikan") %>" 
                class="logo-img"
            />
            <div class="hero-kicker">
                <i class="fas fa-star"></i>
                <span><%= Common.getBahasaConfig("Platform SaaS POS & ERP Terintegrasi") %></span>
            </div>
            <h1 class="hero-title-modern">
                <%= Common.getBahasaConfig("Satu Aplikasi untuk Kasir, Toko, dan Seluruh Bisnis Anda") %>
                <span class="text-gradient-soft"><%= Common.getBahasaConfig("Dari Gerai Pertama Sampai Banyak Brand") %></span>
            </h1>
            <p class="hero-subtitle-modern">
                <%= Common.getBahasaConfig("ebisnis.id adalah platform SaaS multi-tenant yang bisa dimulai dari satu mesin kasir, lalu berkembang menjadi ERP multi-perusahaan, multi-brand, multi-toko, multi-gudang, dan multi-investor -- lengkap dengan SDM, Payroll, Akuntansi, Logistik, Produksi, Ekspedisi, hingga bagi hasil investor, dalam satu sistem yang sama.") %>
            </p>

            <div class="hero-cta-group">
                <a href="#section-daftar" class="btn btn-hero-primary">
                    <i class="fas fa-rocket me-2"></i><%= Common.getBahasaConfig("Daftar Gratis Sekarang") %>
                </a>
                <a href="#section-harga" class="btn btn-hero-outline">
                    <i class="fas fa-tags me-2"></i><%= Common.getBahasaConfig("Lihat Harga") %>
                </a>
                <a href="#section-daftar" class="btn btn-hero-outline">
                    <i class="fas fa-right-to-bracket me-2"></i><%= Common.getBahasaConfig("Sudah Punya Akun? Masuk") %>
                </a>
            </div>

            <div class="client-pill-premium">
                <img src="<%=logo_PerguruanTinggi%>" alt="ebisnis.id" style="height: 28px; width: 28px; border-radius: 8px; vertical-align: middle; margin-right: 8px;"><%=judul%>
            </div>

            <% if (sudahLoginPendaftar) { %>
                <div class="mt-3 fs-5 text-white fw-medium">
                    <%= Common.getBahasaConfig("Selamat datang kembali,") %> <br>
                    <span class="text-warning fs-4 fw-bold"><%=StringEscapeUtils.escapeHtml(sesiPendaftarNama)%></span>
                    <div class="mt-2">
                        <a href="<%=request.getContextPath()%>/EbisnisPublic" class="btn btn-hero-outline btn-sm">
                            <i class="fas fa-gauge me-2"></i><%= Common.getBahasaConfig("Buka Dashboard") %>
                        </a>
                    </div>
                </div>
            <% } %>

            <div class="hero-trust-grid">
                <div class="hero-trust-item">
                    <i class="fas fa-qrcode"></i>
                    <strong><%= Common.getBahasaConfig("Aktivasi via QR Code") %></strong>
                    <span><%= Common.getBahasaConfig("Pasang mesin kasir baru cukup scan QR/kode instalasi sekali, langsung terhubung ke toko Anda.") %></span>
                </div>
                <div class="hero-trust-item">
                    <i class="fas fa-wifi"></i>
                    <strong><%= Common.getBahasaConfig("Offline-First") %></strong>
                    <span><%= Common.getBahasaConfig("Penjualan tidak berhenti saat internet putus -- transaksi tersinkron aman begitu online kembali.") %></span>
                </div>
                <div class="hero-trust-item">
                    <i class="fas fa-sitemap"></i>
                    <strong><%= Common.getBahasaConfig("Multi-Brand & Multi-Toko") %></strong>
                    <span><%= Common.getBahasaConfig("Satu pendaftar bisa punya banyak brand, dan tiap brand punya banyak toko/gerai/cafe.") %></span>
                </div>
                <div class="hero-trust-item">
                    <i class="fas fa-handshake"></i>
                    <strong><%= Common.getBahasaConfig("Investor & Bagi Hasil") %></strong>
                    <span><%= Common.getBahasaConfig("Kelola kepemilikan banyak investor lintas toko dan brand, bagi hasil otomatis setelah biaya operasional.") %></span>
                </div>
            </div>

        </div>
    </header>

    <main class="container text-center" style="margin-top: -6rem; position: relative; z-index: 10;">
        
        <div class="floating-nav-wrapper d-none d-lg-flex">
            <nav class="navbar navbar-expand-lg floating-nav">
                <ul class="navbar-nav landing-nav-list">
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-intro"><i class="fas fa-home me-1"></i> <%= Common.getBahasaConfig("Beranda") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-executive"><i class="fas fa-clipboard-check me-1"></i> <%= Common.getBahasaConfig("Ringkasan") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-portal"><i class="fas fa-th me-1"></i> <%= Common.getBahasaConfig("Portal Terpadu") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-products"><i class="fas fa-sitemap me-1"></i> <%= Common.getBahasaConfig("Struktur Bisnis") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-value"><i class="fas fa-gem me-1"></i> <%= Common.getBahasaConfig("Keunggulan") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-harga"><i class="fas fa-tags me-1"></i> <%= Common.getBahasaConfig("Harga") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-spi"><i class="fas fa-handshake me-1"></i> <%= Common.getBahasaConfig("Investor") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-roadmap"><i class="fas fa-route me-1"></i> <%= Common.getBahasaConfig("Cara Memulai") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-modules"><i class="fas fa-boxes me-1"></i> <%= Common.getBahasaConfig("Modul Manajemen") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-about"><i class="fas fa-info-circle me-1"></i> <%= Common.getBahasaConfig("Tentang") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-payment"><i class="fas fa-wallet me-1"></i> <%= Common.getBahasaConfig("Pembayaran") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-hardware"><i class="fas fa-cash-register me-1"></i> <%= Common.getBahasaConfig("Hardware POS") %></a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link custom-nav-link" href="#section-daftar"><i class="fas fa-user-plus me-1"></i> <%= Common.getBahasaConfig("Daftar / Masuk") %></a>
                    </li>
                </ul>
            </nav>
        </div>
        
        <div class="d-lg-none sticky-top mb-4" style="top: 10px; z-index: 1050;">
            <nav class="navbar navbar-light mobile-smart-nav px-3">
                <a class="navbar-brand fw-bold text-primary fs-6" href="#">
                    <i class="fas fa-bars me-2"></i><%= Common.getBahasaConfig("Menu Navigasi") %>
                </a>
                <button 
                    class="navbar-toggler border-0" 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#mobileNav" 
                >
                    <span class="navbar-toggler-icon" style="transform: scale(0.8);"></span>
                </button>
                <div class="collapse navbar-collapse mt-3" id="mobileNav">
                    <ul class="navbar-nav text-start ms-2 mb-2">
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-intro"><i class="fas fa-home me-2 text-primary"></i><%= Common.getBahasaConfig("Beranda") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-executive"><i class="fas fa-clipboard-check me-2 text-primary"></i><%= Common.getBahasaConfig("Ringkasan Eksekutif") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-portal"><i class="fas fa-th me-2 text-primary"></i><%= Common.getBahasaConfig("Portal Terpadu") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-products"><i class="fas fa-sitemap me-2 text-primary"></i><%= Common.getBahasaConfig("Struktur Bisnis") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-value"><i class="fas fa-gem me-2 text-primary"></i><%= Common.getBahasaConfig("Keunggulan") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-harga"><i class="fas fa-tags me-2 text-primary"></i><%= Common.getBahasaConfig("Harga Berlangganan") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-spi"><i class="fas fa-handshake me-2 text-primary"></i><%= Common.getBahasaConfig("Investor & Bagi Hasil") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-roadmap"><i class="fas fa-route me-2 text-primary"></i><%= Common.getBahasaConfig("Cara Memulai") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-modules"><i class="fas fa-boxes me-2 text-primary"></i><%= Common.getBahasaConfig("Modul Manajemen") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-about"><i class="fas fa-info-circle me-2 text-primary"></i><%= Common.getBahasaConfig("Tentang Sistem") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-payment"><i class="fas fa-wallet me-2 text-primary"></i><%= Common.getBahasaConfig("Pembayaran") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-hardware"><i class="fas fa-cash-register me-2 text-primary"></i><%= Common.getBahasaConfig("Hardware POS") %></a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link fw-semibold text-dark" href="#section-daftar"><i class="fas fa-user-plus me-2 text-primary"></i><%= Common.getBahasaConfig("Daftar / Masuk") %></a>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>

        <div id="section-intro" class="row justify-content-center mb-4">
            <div class="col-lg-12 col-xl-11">
                <div class="glass-intro p-4 p-lg-5 text-start">
                    <div class="row align-items-start g-5">
                        
                        <div class="col-lg-7 order-2 order-lg-1">
                            <h2 class="fw-bold mb-3" style="color: var(--primary-color);">
                                <i class="fas fa-chart-line me-2"></i><%= Common.getBahasaConfig("Dari Kasir Tunggal Menuju ERP Multi-Bisnis") %>
                            </h2>
                            <p class="text-secondary" style="line-height: 1.8; text-align: justify; font-size: 1.05rem;">
                                <%= Common.getBahasaConfig("Pelaku usaha di Indonesia butuh sistem yang bisa dimulai sederhana -- satu toko, satu mesin kasir -- tapi tidak mentok begitu bisnis berkembang jadi banyak gerai, banyak brand, dan melibatkan investor. ebisnis.id dirancang untuk perjalanan itu: mulai dari kasir harian, tumbuh menjadi ERP retail dan manufaktur penuh.") %>
                            </p>
                            <p class="text-secondary mb-0" style="line-height: 1.8; text-align: justify; font-size: 1.05rem;">
                                <%= Common.getBahasaConfig("Satu platform SaaS multi-tenant, offline-first, dan API-first -- data bisnis Anda tetap milik Anda, terisolasi rapi dari pengguna lain, dan bisa diakses lewat aplikasi Desktop maupun Mobile yang sama.") %>
                            </p>
                        </div>

                        <div class="col-lg-5 order-1 order-lg-2">
                            <div class="video-wrapper shadow-lg sticky-md-top" style="border: 4px solid rgba(255,255,255,0.9); border-radius: 16px; top: 1rem; overflow: hidden;">
                                <div class="ratio ratio-16x9">
                                    <svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="<%= Common.getBahasaConfig("Ilustrasi kasir melayani pelanggan dengan ramah") %>">
                                        <defs>
                                            <linearGradient id="ebisnisIntroBg" x1="0" y1="0" x2="800" y2="450" gradientUnits="userSpaceOnUse">
                                                <stop offset="0" stop-color="#1E3A5F"/>
                                                <stop offset="1" stop-color="#13293D"/>
                                            </linearGradient>
                                            <linearGradient id="ebisnisIntroCounter" x1="0" y1="270" x2="0" y2="450" gradientUnits="userSpaceOnUse">
                                                <stop offset="0" stop-color="#C0563D"/>
                                                <stop offset="1" stop-color="#9c4530"/>
                                            </linearGradient>
                                            <linearGradient id="ebisnisIntroApron" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0" stop-color="#C0563D"/>
                                                <stop offset="1" stop-color="#9c4530"/>
                                            </linearGradient>
                                        </defs>
                                        <rect x="0" y="0" width="800" height="450" fill="url(#ebisnisIntroBg)"/>
                                        <ellipse cx="400" cy="430" rx="380" ry="26" fill="#000000" opacity="0.12"/>
                                        <g opacity="0.14">
                                            <rect x="60" y="70" width="130" height="150" rx="10" fill="#FFFFFF"/>
                                            <rect x="80" y="90" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="80" y="120" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="80" y="150" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="80" y="180" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="610" y="60" width="130" height="160" rx="10" fill="#FFFFFF"/>
                                            <rect x="630" y="82" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="630" y="112" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="630" y="142" width="90" height="18" rx="6" fill="#13293D"/>
                                            <rect x="630" y="172" width="90" height="18" rx="6" fill="#13293D"/>
                                        </g>
                                        <g>
                                            <path d="M198 400 C198 330 232 288 288 288 C344 288 378 330 378 400 L378 410 L198 410 Z" fill="url(#ebisnisIntroApron)"/>
                                            <path d="M250 292 C260 305 316 305 326 292 L322 330 L254 330 Z" fill="#F4EFE6"/>
                                            <rect x="272" y="240" width="32" height="34" rx="14" fill="#E8B98A"/>
                                            <circle cx="288" cy="205" r="46" fill="#F0C89A"/>
                                            <path d="M242 200 C238 156 260 132 288 132 C316 132 338 156 334 200 C328 178 306 168 288 168 C270 168 246 178 242 200 Z" fill="#3B2A20"/>
                                            <circle cx="332" cy="210" r="8" fill="#E8B98A"/>
                                            <path d="M266 216 Q288 236 310 216" stroke="#7A4A2C" stroke-width="5" fill="none" stroke-linecap="round"/>
                                            <circle cx="272" cy="198" r="5" fill="#3B2A20"/>
                                            <circle cx="304" cy="198" r="5" fill="#3B2A20"/>
                                            <circle cx="258" cy="212" r="9" fill="#E77A63" opacity="0.35"/>
                                            <circle cx="318" cy="212" r="9" fill="#E77A63" opacity="0.35"/>
                                            <path d="M340 316 C362 288 372 254 366 222" stroke="#F0C89A" stroke-width="25" fill="none" stroke-linecap="round"/>
                                            <g transform="translate(366,214) rotate(-8)">
                                                <ellipse cx="0" cy="10" rx="17" ry="20" fill="#F0C89A"/>
                                                <rect x="-15" y="-22" width="9" height="26" rx="4.5" fill="#F0C89A" transform="rotate(-14 -10 -9)"/>
                                                <rect x="-5" y="-26" width="9" height="28" rx="4.5" fill="#F0C89A" transform="rotate(-4 -1 -12)"/>
                                                <rect x="5" y="-26" width="9" height="28" rx="4.5" fill="#F0C89A" transform="rotate(6 9 -12)"/>
                                                <rect x="14" y="-20" width="9" height="24" rx="4.5" fill="#F0C89A" transform="rotate(16 18 -8)"/>
                                            </g>
                                            <path d="M234 330 C210 344 200 366 206 388" stroke="#F0C89A" stroke-width="26" fill="none" stroke-linecap="round"/>
                                            <rect x="260" y="352" width="56" height="34" rx="8" fill="#9c4530"/>
                                            <path d="M262 292 L288 316 L314 292" stroke="#7a3626" stroke-width="6" fill="none" stroke-linecap="round"/>
                                        </g>
                                        <g fill="#F5A623">
                                            <path d="M418 196 l6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6 z" opacity="0.9"/>
                                        </g>
                                        <rect x="150" y="300" width="500" height="40" rx="8" fill="url(#ebisnisIntroCounter)"/>
                                        <rect x="150" y="340" width="500" height="70" rx="10" fill="#0f2233"/>
                                        <rect x="150" y="340" width="500" height="10" fill="#000000" opacity="0.15"/>
                                        <g>
                                            <rect x="392" y="248" width="96" height="70" rx="10" fill="#FFFFFF"/>
                                            <rect x="400" y="256" width="80" height="46" rx="4" fill="#1E3A5F"/>
                                            <rect x="408" y="264" width="46" height="6" rx="3" fill="#7fd6c2"/>
                                            <rect x="408" y="276" width="60" height="6" rx="3" fill="#7fd6c2" opacity="0.7"/>
                                            <rect x="408" y="288" width="34" height="6" rx="3" fill="#7fd6c2" opacity="0.5"/>
                                            <rect x="424" y="318" width="32" height="10" rx="3" fill="#c9c9c9"/>
                                            <rect x="486" y="252" width="14" height="34" rx="6" fill="#e2e2e2"/>
                                        </g>
                                        <path d="M446 248 q-4 -16 4 -24 q-4 -14 6 -20 q-2 -14 8 -18" stroke="#F4EFE6" stroke-width="9" fill="none" stroke-linecap="round"/>
                                        <g>
                                            <path d="M556 412 C554 372 566 340 596 328 C608 323 640 323 652 328 C682 340 694 372 692 412 Z" fill="#2E6F63"/>
                                            <path d="M600 330 C608 342 640 342 648 330 L644 352 L604 352 Z" fill="#F4EFE6"/>
                                            <rect x="608" y="272" width="30" height="32" rx="14" fill="#C98A5E"/>
                                            <circle cx="624" cy="240" r="42" fill="#D89B6C"/>
                                            <path d="M584 236 C580 198 600 178 624 178 C648 178 668 198 666 234 C660 214 642 206 624 206 C608 206 588 214 584 236 Z" fill="#241812"/>
                                            <path d="M604 250 Q624 268 644 250" stroke="#6b3d24" stroke-width="5" fill="none" stroke-linecap="round"/>
                                            <circle cx="610" cy="234" r="4.5" fill="#241812"/>
                                            <circle cx="638" cy="234" r="4.5" fill="#241812"/>
                                            <path d="M582 350 C566 366 560 384 566 402" stroke="#D89B6C" stroke-width="24" fill="none" stroke-linecap="round"/>
                                            <g transform="translate(520,368)">
                                                <rect x="0" y="14" width="60" height="54" rx="6" fill="#F5A623"/>
                                                <path d="M14 14 L14 -6 Q30 -22 46 -6 L46 14" stroke="#9c4530" stroke-width="7" fill="none" stroke-linecap="round"/>
                                                <rect x="10" y="34" width="40" height="6" rx="3" fill="#9c4530" opacity="0.5"/>
                                            </g>
                                        </g>
                                        <rect x="0" y="418" width="800" height="4" fill="#FFFFFF" opacity="0.06"/>
                                    </svg>
                                </div>
                                <div class="bg-white p-3 text-center border-top">
                                    <h6 class="fw-bold text-dark mb-0">
                                        <i class="fa fa-store text-primary me-2"></i><%= Common.getBahasaConfig("Satu Sistem, Semua Toko Anda") %>
                                    </h6>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>


        <div id="section-executive" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative mb-4">
                        <div class="enterprise-ribbon-v2">
                            <i class="fas fa-clipboard-check"></i><%= Common.getBahasaConfig("Ringkasan Eksekutif") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Bukan Sekadar Aplikasi Kasir, Tapi Pusat Data Bisnis Anda") %>
                        </h2>
                        <p class="section-lead-premium mb-0">
                            <%= Common.getBahasaConfig("ebisnis.id dirancang sebagai platform SaaS multi-tenant yang memungkinkan siapa pun mendaftarkan bisnis, membuat brand dan toko/gerai, mengaktifkan mesin kasir lewat QR Code, menjalankan masa uji coba satu bulan, lalu berlangganan per perangkat. Akses pemilik, investor, dan manajemen tidak dikenakan biaya perangkat sama sekali.") %>
                        </p>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-6 col-xl-3">
                            <div class="executive-brief-card">
                                <div class="executive-icon"><i class="fas fa-database"></i></div>
                                <h4><%= Common.getBahasaConfig("Satu Data, Banyak Layanan") %></h4>
                                <p><%= Common.getBahasaConfig("Data utama institusi tidak lagi tersebar di banyak file dan aplikasi. Setiap unit kerja menggunakan sumber data yang sama sehingga laporan lebih konsisten, mudah diverifikasi, dan siap dipakai untuk audit maupun akreditasi.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="executive-brief-card">
                                <div class="executive-icon"><i class="fas fa-bolt"></i></div>
                                <h4><%= Common.getBahasaConfig("Layanan Lebih Cepat") %></h4>
                                <p><%= Common.getBahasaConfig("Alur pendaftaran, pembayaran, validasi akademik, persetujuan surat, pengajuan internal, presensi, dan layanan pengguna dapat diproses lebih singkat melalui portal digital, notifikasi, serta riwayat transaksi yang terdokumentasi.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="executive-brief-card">
                                <div class="executive-icon"><i class="fas fa-chart-line"></i></div>
                                <h4><%= Common.getBahasaConfig("Keputusan Berbasis Dashboard") %></h4>
                                <p><%= Common.getBahasaConfig("Pimpinan dapat membaca indikator penting seperti perkembangan akademik, penerimaan pembayaran, piutang, kinerja SDM, aset, layanan, dan aktivitas operasional melalui dashboard yang ringkas, informatif, dan mudah dipahami.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="executive-brief-card">
                                <div class="executive-icon"><i class="fas fa-handshake-angle"></i></div>
                                <h4><%= Common.getBahasaConfig("Kemitraan Implementasi") %></h4>
                                <p><%= Common.getBahasaConfig("Kerja sama tidak berhenti pada instalasi sistem. Kami menyiapkan pendekatan bertahap mulai dari assessment, konfigurasi, migrasi data, pelatihan, go-live, pendampingan, hingga evaluasi pemanfaatan sistem.") %></p>
                            </div>
                        </div>
                    </div>

                    <div class="formal-note-box mt-4">
                        <div class="note-title"><i class="fas fa-file-signature me-2"></i><%= Common.getBahasaConfig("Materi Resmi Disiapkan Lengkap untuk Proses Pengambilan Keputusan") %></div>
                        <p class="note-text">
                            <%= Common.getBahasaConfig("Untuk memudahkan calon mitra, ekosistem ini dilengkapi dengan halaman presentasi siap tayang, proposal siap cetak, surat penawaran, serta draf perjanjian kerja sama. Setiap dokumen disusun agar pimpinan, tim teknis, keuangan, pengadaan, dan legal dapat memahami ruang lingkup, manfaat, skema kerja sama, serta tahapan implementasi secara lebih jelas.") %>
                        </p>
                    </div>
                </div>
            </div>
        </div>


        <div id="section-products" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative">
                        <div class="section-eyebrow">
                            <i class="fas fa-sitemap"></i><%= Common.getBahasaConfig("Struktur Bisnis Anda") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Satu Pendaftar, Banyak Brand, Banyak Toko, Banyak Mesin Kasir") %>
                        </h2>
                        <p class="section-lead-premium">
                            <%= Common.getBahasaConfig("Saat mendaftar, Anda menjadi Pendaftar/Account Owner. Dari satu akun itu, Anda bebas membentuk struktur bisnis sebesar apa pun -- mulai dari satu toko sederhana, sampai beberapa brand dengan puluhan gerai dan banyak mesin kasir. Setiap tingkat berikut menyimpan datanya sendiri, tapi tetap terkonsolidasi ke satu Pendaftar yang sama.") %>
                        </p>
                    </div>

                    <div class="ee-prod-grid">
                        <div class="ee-prod-card">
                            <div class="ee-prod-badge" style="background: linear-gradient(135deg, #1E3A5F, #13293D);">
                                <i class="fas fa-user-tie"></i>
                            </div>
                            <h4><%= Common.getBahasaConfig("1. Pendaftar") %></h4>
                            <span class="ee-prod-for" style="color: #1E3A5F;"><%= Common.getBahasaConfig("Akun Utama Bisnis Anda") %></span>
                            <p>
                                <%= Common.getBahasaConfig("Satu akun pendaftaran mewakili satu badan usaha/perorangan. Di sinilah data identitas bisnis, wilayah, kontak, dan kredensial login tersimpan -- menjadi induk dari seluruh brand, toko, mesin kasir, tim manajemen, dan investor di bawahnya.") %>
                            </p>
                            <div class="ee-prod-chips">
                                <span><%= Common.getBahasaConfig("Registrasi Mandiri") %></span>
                                <span><%= Common.getBahasaConfig("Identitas Bisnis") %></span>
                                <span><%= Common.getBahasaConfig("Login Email + Password") %></span>
                            </div>
                        </div>

                        <div class="ee-prod-card">
                            <div class="ee-prod-badge" style="background: linear-gradient(135deg, #C0563D, #9c4530);">
                                <i class="fas fa-copyright"></i>
                            </div>
                            <h4><%= Common.getBahasaConfig("2. Brand (Sub-Brand)") %></h4>
                            <span class="ee-prod-for" style="color: #C0563D;"><%= Common.getBahasaConfig("Identitas Komersial") %></span>
                            <p>
                                <%= Common.getBahasaConfig("Satu Pendaftar boleh memiliki beberapa Brand/Sub-Brand -- misalnya sekaligus punya brand kopi dan brand makanan cepat saji. Tiap brand punya identitas, logo, dan kebijakan default sendiri, tapi tetap dikonsolidasikan ke Pendaftar yang sama untuk pelaporan lintas-brand.") %>
                            </p>
                            <div class="ee-prod-chips">
                                <span><%= Common.getBahasaConfig("Banyak Brand per Pendaftar") %></span>
                                <span><%= Common.getBahasaConfig("Logo & Kebijakan Sendiri") %></span>
                                <span><%= Common.getBahasaConfig("Laporan Konsolidasi") %></span>
                            </div>
                        </div>

                        <div class="ee-prod-card">
                            <div class="ee-prod-badge" style="background: linear-gradient(135deg, #2E7D32, #1b5e20);">
                                <i class="fas fa-store"></i>
                            </div>
                            <h4><%= Common.getBahasaConfig("3. Toko / Gerai / Cafe") %></h4>
                            <span class="ee-prod-for" style="color: #2E7D32;"><%= Common.getBahasaConfig("Lokasi Operasional") %></span>
                            <p>
                                <%= Common.getBahasaConfig("Di bawah tiap brand, Anda menambahkan sebanyak mungkin toko/gerai/cafe sesuai kebutuhan ekspansi. Setiap toko punya data operasional, stok, dan transaksinya sendiri -- lokasi baru cukup ditambahkan lewat form, tanpa instalasi terpisah.") %>
                            </p>
                            <div class="ee-prod-chips">
                                <span><%= Common.getBahasaConfig("Banyak Toko per Brand") %></span>
                                <span><%= Common.getBahasaConfig("Data Toko Terisolasi") %></span>
                                <span><%= Common.getBahasaConfig("Tambah Toko Kapan Saja") %></span>
                            </div>
                        </div>

                        <div class="ee-prod-card">
                            <div class="ee-prod-badge" style="background: linear-gradient(135deg, #B8860B, #8a640a);">
                                <i class="fas fa-cash-register"></i>
                            </div>
                            <h4><%= Common.getBahasaConfig("4. Mesin POS") %></h4>
                            <span class="ee-prod-for" style="color: #B8860B;"><%= Common.getBahasaConfig("Unit yang Ditagih Bulanan") %></span>
                            <p>
                                <%= Common.getBahasaConfig("Satu toko boleh memakai lebih dari satu mesin kasir (mis. kasir depan + kasir drive-thru). Setiap mesin diaktifkan sekali lewat QR Code/kode instalasi, lalu menjadi unit penagihan mandiri -- inilah yang ditagih langganan bulanannya, bukan toko atau brand-nya.") %>
                            </p>
                            <div class="ee-prod-chips">
                                <span><%= Common.getBahasaConfig("Aktivasi QR Sekali Pakai") %></span>
                                <span><%= Common.getBahasaConfig("Unit Penagihan") %></span>
                                <span><%= Common.getBahasaConfig("Trial 30 Hari") %></span>
                            </div>
                        </div>
                    </div>

                    <div class="ee-prod-foot">
                        <i class="fas fa-puzzle-piece me-2"></i>
                        <strong><%= Common.getBahasaConfig("Struktur tumbuh mengikuti bisnis Anda.") %></strong>
                        <%= Common.getBahasaConfig("Mulai dari satu toko dan satu mesin kasir hari ini, lalu tambahkan brand baru, toko baru, dan mesin baru kapan pun bisnis Anda berkembang -- semuanya tanpa migrasi data dan tanpa mengganti sistem.") %>
                    </div>
                </div>
            </div>
        </div>


        <div id="section-value" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative">
                        <div class="section-eyebrow">
                            <i class="fas fa-gem"></i><%= Common.getBahasaConfig("Prinsip Produk") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Kenapa ebisnis.id Dibangun Berbeda") %>
                        </h2>
                        <p class="section-lead-premium">
                            <%= Common.getBahasaConfig("Setiap keputusan teknis di ebisnis.id kembali ke tujuan yang sama: bisnis Anda tetap berjalan meski jaringan putus, data Anda milik Anda sendiri, dan sistem bisa dikonfigurasi -- bukan dipaksa mengikuti aturan baku yang kaku.") %>
                        </p>
                    </div>

                    <div class="row g-4 mt-2">
                        <div class="col-md-6 col-xl-3">
                            <div class="benefit-card">
                                <div class="benefit-icon"><i class="fas fa-building-shield"></i></div>
                                <h4><%= Common.getBahasaConfig("SaaS Multi-Tenant") %></h4>
                                <p><%= Common.getBahasaConfig("Satu platform melayani banyak pelanggan sekaligus, dengan isolasi data dan konfigurasi penuh antar bisnis -- data Anda tidak pernah tercampur dengan pelanggan lain.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="benefit-card">
                                <div class="benefit-icon"><i class="fas fa-wifi"></i></div>
                                <h4><%= Common.getBahasaConfig("Offline-First") %></h4>
                                <p><%= Common.getBahasaConfig("Penjualan tidak berhenti ketika jaringan internet putus. Transaksi tetap tercatat lokal, lalu tersinkronisasi otomatis dan andal begitu koneksi kembali.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="benefit-card">
                                <div class="benefit-icon"><i class="fas fa-plug"></i></div>
                                <h4><%= Common.getBahasaConfig("API-First") %></h4>
                                <p><%= Common.getBahasaConfig("Semua fungsi strategis tersedia lewat kontrak API berversi dan terdokumentasi -- siap diintegrasikan dengan sistem lain kapan pun dibutuhkan.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-3">
                            <div class="benefit-card">
                                <div class="benefit-icon"><i class="fas fa-sliders"></i></div>
                                <h4><%= Common.getBahasaConfig("Configurable, Bukan Hard-Coded") %></h4>
                                <p><%= Common.getBahasaConfig("Harga, workflow, peran pengguna, pajak, diskon, kontrak bagi hasil, dan formula perhitungan semuanya dapat dikonfigurasi sesuai kebijakan bisnis Anda.") %></p>
                            </div>
                        </div>
                    </div>

                    <div class="platform-strip">
                        <div class="platform-item">
                            <i class="fas fa-cash-register"></i>
                            <strong><%= Common.getBahasaConfig("Kasir") %></strong>
                            <span><%= Common.getBahasaConfig("Penjualan harian, cetak struk, buka/tutup shift -- tetap jalan walau sedang offline.") %></span>
                        </div>
                        <div class="platform-item">
                            <i class="fas fa-user-tie"></i>
                            <strong><%= Common.getBahasaConfig("Pemilik & Investor") %></strong>
                            <span><%= Common.getBahasaConfig("Laporan lintas toko dan brand, posisi bagi hasil, tanpa biaya lisensi perangkat.") %></span>
                        </div>
                        <div class="platform-item">
                            <i class="fas fa-people-group"></i>
                            <strong><%= Common.getBahasaConfig("Manajemen") %></strong>
                            <span><%= Common.getBahasaConfig("Akses modul ERP sesuai jabatan: SDM, Payroll, Akunting, Logistik, Produksi, dan lainnya.") %></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="section-harga" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative">
                        <div class="section-eyebrow">
                            <i class="fas fa-tags"></i><%= Common.getBahasaConfig("Harga & Paket Berlangganan") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Bayar per Mesin Kasir, Pilih Paket Modul Sesuai Kebutuhan") %>
                        </h2>
                        <p class="section-lead-premium">
                            <%= Common.getBahasaConfig("Unit penagihan utama adalah satu mesin POS aktif -- tiga paket modul tersedia, dari kasir polos sampai ERP lengkap. Akses mobile/web Pemilik, Investor, dan Manajemen TIDAK dikenakan biaya per perangkat. Semua mesin baru mendapat masa uji coba 30 hari kalender secara gratis sebelum wajib berlangganan.") %>
                        </p>
                    </div>

                    <div class="ee-ai-grid">
                        <div class="ee-ai-pillar">
                            <div class="ee-ai-num"><i class="fas fa-cash-register"></i></div>
                            <h5><%= Common.getBahasaConfig("Paket POS -- Rp250.000/bulan") %></h5>
                            <p><%= Common.getBahasaConfig("Modul Kasir (POS) saja -- katalog produk, transaksi, cetak struk, dan laporan penjualan dasar. Paling ringan, cocok untuk toko/gerai yang baru mulai.") %></p>
                        </div>
                        <div class="ee-ai-pillar">
                            <div class="ee-ai-num"><i class="fas fa-calculator"></i></div>
                            <h5><%= Common.getBahasaConfig("Paket Bisnis -- Rp500.000/bulan") %></h5>
                            <p><%= Common.getBahasaConfig("POS + Keuangan (Finance) & Akunting + Logistik -- arus kas, jurnal otomatis, dan distribusi antar toko/gudang menyatu langsung dengan kasir.") %></p>
                        </div>
                        <div class="ee-ai-pillar">
                            <div class="ee-ai-num"><i class="fas fa-layer-group"></i></div>
                            <h5><%= Common.getBahasaConfig("Paket Lengkap -- Rp750.000/bulan") %></h5>
                            <p><%= Common.getBahasaConfig("Semua modul ERP -- POS, Keuangan & Akunting, Logistik, SDM, Payroll, Aset & Inventaris, Surat Menyurat, Workflow, hingga bagi hasil Investor.") %></p>
                        </div>
                    </div>

                    <div class="ee-ai-engine">
                        <div class="ee-ai-box is-primary">
                            <h6><i class="fas fa-gift me-2" style="color: #059669;"></i><%= Common.getBahasaConfig("Trial 30 Hari, Sekali per Mesin") %></h6>
                            <p><%= Common.getBahasaConfig("Setiap mesin baru mendapat masa uji coba satu bulan penuh sejak aktivasi pertama, pada paket manapun yang dipilih. Menghapus dan memasang ulang aplikasi TIDAK mengatur ulang masa trial -- satu identitas mesin, satu jatah trial.") %></p>
                        </div>
                        <div class="ee-ai-box">
                            <h6><i class="fas fa-percent me-2" style="color: #d97706;"></i><%= Common.getBahasaConfig("Diskon Komitmen Jangka Panjang") %></h6>
                            <p><%= Common.getBahasaConfig("Diskon 10% untuk komitmen 3 bulan, 15% untuk 6 bulan, dan 20% untuk 12 bulan -- berlaku sama rata untuk paket POS, Bisnis, maupun Lengkap, dihitung dari harga bulanan paket yang dipilih.") %></p>
                        </div>
                        <div class="ee-ai-box">
                            <h6><i class="fas fa-credit-card me-2" style="color: #2563eb;"></i><%= Common.getBahasaConfig("Pembayaran via Smartlink") %></h6>
                            <p><%= Common.getBahasaConfig("Perpanjangan langganan diproses lewat Smartlink -- pilih channel pembayaran, konfirmasi otomatis, dan mesin langsung aktif kembali begitu pembayaran tervalidasi.") %></p>
                        </div>
                    </div>

                    <div class="ee-ai-note">
                        <i class="fas fa-circle-info me-2" style="color: #334155;"></i>
                        <strong><%= Common.getBahasaConfig("Harga dasar sebelum pajak/biaya administrasi yang berlaku.") %></strong>
                        <%= Common.getBahasaConfig("Setiap invoice menyimpan salinan harga, paket, diskon, pajak, dan periode saat itu -- perubahan daftar harga atau paket di kemudian hari tidak pernah mengubah invoice yang sudah terbit. Naik/turun paket bisa dilakukan kapan saja lewat Smartlink, berlaku mulai periode tagihan berikutnya.") %>
                    </div>
                </div>
            </div>
        </div>

        <div id="section-spi" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative">
                        <div class="section-eyebrow">
                            <i class="fas fa-handshake"></i><%= Common.getBahasaConfig("Investor & Bagi Hasil") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Kelola Kepemilikan Lintas Toko dan Brand dengan Transparan") %>
                        </h2>
                        <p class="section-lead-premium">
                            <%= Common.getBahasaConfig("Satu Pendaftar boleh memiliki lebih dari satu investor, dan satu investor boleh memiliki bagian di banyak toko/gerai maupun banyak brand sekaligus. ebisnis.id menyediakan tata kelola khusus untuk mengatur pembagian hasil di tiap toko/gerai dan brand -- tentunya setelah dikurangi biaya operasional perusahaan.") %>
                        </p>
                    </div>

                    <div class="ee-spi-grid">
                        <div class="ee-spi-card">
                            <div class="ee-spi-ic"><i class="fas fa-users-rectangle"></i></div>
                            <h5><%= Common.getBahasaConfig("Banyak Investor per Pendaftar") %></h5>
                            <p><%= Common.getBahasaConfig("Satu bisnis boleh didanai oleh lebih dari satu investor/pemilik. Setiap investor punya identitasnya sendiri dan hanya melihat data sesuai kepemilikannya.") %></p>
                        </div>
                        <div class="ee-spi-card">
                            <div class="ee-spi-ic"><i class="fas fa-diagram-project"></i></div>
                            <h5><%= Common.getBahasaConfig("Kepemilikan Lintas Toko & Brand") %></h5>
                            <p><%= Common.getBahasaConfig("Satu investor boleh punya bagian di banyak toko sekaligus banyak brand -- proporsinya bisa berbeda-beda di tiap lokasi sesuai kontrak kerja sama.") %></p>
                        </div>
                        <div class="ee-spi-card">
                            <div class="ee-spi-ic"><i class="fas fa-scale-balanced"></i></div>
                            <h5><%= Common.getBahasaConfig("Bagi Hasil Setelah Biaya Operasional") %></h5>
                            <p><%= Common.getBahasaConfig("Perhitungan bagi hasil dilakukan setelah biaya operasional perusahaan dikurangkan -- bukan dari omzet kotor -- sehingga pembagian mencerminkan keuntungan sesungguhnya.") %></p>
                        </div>
                        <div class="ee-spi-card">
                            <div class="ee-spi-ic"><i class="fas fa-chart-pie"></i></div>
                            <h5><%= Common.getBahasaConfig("Laporan Lintas Outlet") %></h5>
                            <p><%= Common.getBahasaConfig("Pemilik/investor memperoleh laporan lintas toko dan brand dengan login QR sendiri, tanpa biaya lisensi perangkat, kapan pun ingin memantau performa investasinya.") %></p>
                        </div>
                    </div>

                    <div class="ee-spi-verticals">
                        <div class="ee-spi-vert">
                            <strong><%= Common.getBahasaConfig("Login Tanpa Biaya") %></strong>
                            <span><%= Common.getBahasaConfig("QR khusus Pemilik/Investor -- scan dan langsung masuk, tanpa username, tanpa dikenakan biaya lisensi mesin kasir.") %></span>
                        </div>
                        <div class="ee-spi-vert">
                            <strong><%= Common.getBahasaConfig("Kontrak Bagi Hasil Berversi") %></strong>
                            <span><%= Common.getBahasaConfig("Perubahan persentase bagi hasil tersimpan sebagai versi baru -- kontrak lama tidak ikut berubah, laporan lama tetap konsisten.") %></span>
                        </div>
                        <div class="ee-spi-vert">
                            <strong><%= Common.getBahasaConfig("Settlement Tercatat") %></strong>
                            <span><%= Common.getBahasaConfig("Setiap perhitungan bagi hasil menyimpan data sumber, formula yang dipakai, dan status persetujuan -- dapat direproduksi ulang kapan saja.") %></span>
                        </div>
                        <div class="ee-spi-vert">
                            <strong><%= Common.getBahasaConfig("Manajemen Terpisah") %></strong>
                            <span><%= Common.getBahasaConfig("Investor melihat performa dan bagi hasil; Manajemen menjalankan operasional -- dua peran, dua sudut pandang, satu data yang sama.") %></span>
                        </div>
                    </div>

                    <div class="ee-spi-note">
                        <i class="fas fa-shield-halved me-2"></i>
                        <strong><%= Common.getBahasaConfig("Setiap toko/gerai dan brand punya datanya sendiri.") %></strong>
                        <%= Common.getBahasaConfig("Data keuangan tiap lokasi dan brand tersimpan terpisah rapi, sehingga perhitungan bagi hasil untuk satu toko/brand tidak pernah tercampur dengan toko/brand lainnya milik investor yang sama.") %>
                    </div>
                </div>
            </div>
        </div>

        <div id="section-impact" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative mb-4">
                        <div class="section-eyebrow">
                            <i class="fas fa-arrows-rotate"></i><%= Common.getBahasaConfig("Dampak Transformasi") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Dari Kasir Tradisional Menjadi Pusat Data Bisnis") %>
                        </h2>
                        <p class="section-lead-premium mb-0">
                            <%= Common.getBahasaConfig("Kendala terbesar usaha retail bukan hanya soal mencatat penjualan, tetapi konsistensi data stok, kecepatan rekonsiliasi, dan kemampuan pemilik/investor mengambil keputusan berbasis laporan yang akurat -- bukan tebakan.") %>
                        </p>
                    </div>

                    <div class="pain-solution-row">
                        <div class="comparison-box problem">
                            <h4><i class="fas fa-triangle-exclamation text-warning me-2"></i><%= Common.getBahasaConfig("Kasir Tradisional / Terpisah-pisah") %></h4>
                            <ul class="x-list-modern">
                                <li><i class="fas fa-circle-xmark"></i><span><%= Common.getBahasaConfig("Catatan penjualan tiap toko tersebar di buku, spreadsheet, atau aplikasi kasir yang berbeda-beda dan tidak saling terhubung.") %></span></li>
                                <li><i class="fas fa-circle-xmark"></i><span><%= Common.getBahasaConfig("Kasir berhenti total begitu internet/listrik mati -- penjualan hari itu hilang atau harus dicatat manual dulu.") %></span></li>
                                <li><i class="fas fa-circle-xmark"></i><span><%= Common.getBahasaConfig("Pemilik dan investor menunggu laporan bulanan manual untuk tahu kinerja tiap toko/brand.") %></span></li>
                                <li><i class="fas fa-circle-xmark"></i><span><%= Common.getBahasaConfig("Bagi hasil investor dihitung manual, rawan selisih, dan sulit ditelusuri ulang saat ada pertanyaan.") %></span></li>
                            </ul>
                        </div>
                        <div class="comparison-box solution">
                            <h4><i class="fas fa-circle-check text-success me-2"></i><%= Common.getBahasaConfig("Dengan ebisnis.id") %></h4>
                            <ul class="check-list-modern">
                                <li><i class="fas fa-check-circle"></i><span><%= Common.getBahasaConfig("Semua toko/brand berbagi satu pusat data yang sama, tetap terisolasi rapi dari pengguna lain di platform.") %></span></li>
                                <li><i class="fas fa-check-circle"></i><span><%= Common.getBahasaConfig("Offline-first -- transaksi tetap tercatat lokal saat internet putus, tersinkron otomatis begitu online kembali.") %></span></li>
                                <li><i class="fas fa-check-circle"></i><span><%= Common.getBahasaConfig("Pemilik & investor login QR gratis, bisa memantau performa lintas toko dan brand kapan saja secara langsung.") %></span></li>
                                <li><i class="fas fa-check-circle"></i><span><%= Common.getBahasaConfig("Bagi hasil dihitung sistem dari data transaksi asli, tersimpan versi & formula-nya, bisa direproduksi ulang kapan pun.") %></span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="section-roadmap" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative mb-4">
                        <div class="section-eyebrow">
                            <i class="fas fa-route"></i><%= Common.getBahasaConfig("Cara Memulai") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Dari Daftar Sampai Kasir Pertama Berjualan") %>
                        </h2>
                        <p class="section-lead-premium mb-0">
                            <%= Common.getBahasaConfig("Tidak perlu tim IT atau instalasi rumit. Enam langkah sederhana ini bisa diselesaikan sendiri lewat halaman ini juga.") %>
                        </p>
                    </div>

                    <div class="row g-4">
                        <div class="col-md-6 col-xl-4">
                            <div class="roadmap-step">
                                <div class="roadmap-number">01</div>
                                <h5><%= Common.getBahasaConfig("Daftar Akun Pendaftar") %></h5>
                                <p><%= Common.getBahasaConfig("Isi form Daftar di bawah: nama bisnis, wilayah, kontak, dan email/password untuk login kembali kapan saja.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-4">
                            <div class="roadmap-step">
                                <div class="roadmap-number">02</div>
                                <h5><%= Common.getBahasaConfig("Buat Brand & Toko") %></h5>
                                <p><%= Common.getBahasaConfig("Tambahkan brand/sub-brand Anda, lalu buat toko/gerai/cafe pertama di bawah brand tersebut.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-4">
                            <div class="roadmap-step">
                                <div class="roadmap-number">03</div>
                                <h5><%= Common.getBahasaConfig("Tentukan Jumlah Mesin POS") %></h5>
                                <p><%= Common.getBahasaConfig("Sebutkan berapa mesin kasir yang dibutuhkan tiap toko -- boleh satu, boleh lebih dari satu.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-4">
                            <div class="roadmap-step">
                                <div class="roadmap-number">04</div>
                                <h5><%= Common.getBahasaConfig("Aktivasi via QR Code") %></h5>
                                <p><%= Common.getBahasaConfig("Pasang aplikasi kasir di perangkat, scan QR/kode instalasi sekali -- mesin langsung terhubung ke toko Anda.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-4">
                            <div class="roadmap-step">
                                <div class="roadmap-number">05</div>
                                <h5><%= Common.getBahasaConfig("Uji Coba 30 Hari") %></h5>
                                <p><%= Common.getBahasaConfig("Jalankan kasir seperti biasa, gratis, tanpa kewajiban bayar dulu, sampai 30 hari kalender sejak aktivasi pertama.") %></p>
                            </div>
                        </div>
                        <div class="col-md-6 col-xl-4">
                            <div class="roadmap-step">
                                <div class="roadmap-number">06</div>
                                <h5><%= Common.getBahasaConfig("Berlangganan via Smartlink") %></h5>
                                <p><%= Common.getBahasaConfig("Setelah trial, perpanjang tiap mesin lewat Smartlink -- pilih paket bulanan atau tahunan sesuai kebutuhan.") %></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>


        <div id="section-portal" class="row justify-content-center mb-4">
            <div class="col-lg-12 col-xl-11">
                <div class="menu-panel">
                    <div class="text-center mb-4">
                        <div class="section-eyebrow">
                            <i class="fas fa-th-large"></i><%= Common.getBahasaConfig("Portal Terpadu") %>
                        </div>
                        <h2 class="section-heading-premium mb-2">
                            <%= Common.getBahasaConfig("Satu Aplikasi, Empat Peran Berbeda") %>
                        </h2>
                        <p class="section-lead-premium mb-0">
                            <%= Common.getBahasaConfig("Aplikasi yang sama dipakai oleh empat peran berbeda, masing-masing masuk lewat jalurnya sendiri dan hanya melihat data sesuai kewenangannya.") %>
                        </p>
                    </div>

                    <div class="portal-group-section group-campus mb-4">
                        <div class="section-title">
                            <i class="fas fa-cash-register me-2 text-primary"></i><%= Common.getBahasaConfig("Kasir") %>
                        </div>
                        <div class="portal-support-copy">
                            <i class="fas fa-store"></i>
                            <div>
                                <strong><%= Common.getBahasaConfig("Login username & password, terikat ke satu mesin/toko") %></strong>
                                <span><%= Common.getBahasaConfig("Kasir masuk seperti aplikasi kasir pada umumnya -- katalog produk, keranjang, checkout, cetak struk, buka/tutup shift. Inilah satu-satunya peran yang mesinnya dikenakan biaya langganan bulanan.") %></span>
                            </div>
                        </div>
                        <div class="btn-custom-group portal-action-grid mt-3">
                            <a href="#section-daftar" class="btn btn-primary shadow-sm">
                                <i class="fas fa-user-plus"></i> <%= Common.getBahasaConfig("Daftar Toko Baru") %>
                            </a>
                            <a href="#section-harga" class="btn btn-outline-primary shadow-sm">
                                <i class="fas fa-tags"></i> <%= Common.getBahasaConfig("Lihat Harga Kasir") %>
                            </a>
                        </div>
                        <div class="portal-support-note">
                            <i class="fas fa-check-circle me-2"></i><%= Common.getBahasaConfig("Setiap toko boleh punya lebih dari satu mesin kasir -- tiap mesin diaktifkan dan ditagih terpisah.") %>
                        </div>
                    </div>

                    <hr class="text-muted opacity-10 my-4">

                    <div class="portal-group-section group-school mb-4">
                        <div class="section-title">
                            <i class="fas fa-user-tie me-2 text-dark"></i><%= Common.getBahasaConfig("Pemilik & Investor") %>
                        </div>
                        <div class="portal-support-copy">
                            <i class="fas fa-chart-pie"></i>
                            <div>
                                <strong><%= Common.getBahasaConfig("Login lewat QR khusus, tanpa username, tanpa biaya") %></strong>
                                <span><%= Common.getBahasaConfig("Pemilik dan investor cukup scan QR pribadi mereka untuk langsung masuk -- melihat performa lintas toko dan brand, posisi bagi hasil, dan laporan keuangan ringkas. Tidak dikenakan biaya lisensi perangkat sama sekali.") %></span>
                            </div>
                        </div>
                        <div class="btn-custom-group portal-action-grid mt-3 mb-3">
                            <a href="#section-spi" class="btn btn-dark shadow-sm">
                                <i class="fas fa-handshake"></i> <%= Common.getBahasaConfig("Pelajari Bagi Hasil") %>
                            </a>
                        </div>
                        <div class="portal-support-note">
                            <i class="fas fa-check-circle me-2"></i><%= Common.getBahasaConfig("Satu investor boleh punya bagian di banyak toko sekaligus banyak brand milik Pendaftar yang sama.") %>
                        </div>
                    </div>

                    <hr class="text-muted opacity-10 my-4">

                    <div class="portal-group-section group-campus mb-4">
                        <div class="section-title">
                            <i class="fas fa-people-group me-2 text-primary"></i><%= Common.getBahasaConfig("Manajemen") %>
                        </div>
                        <div class="portal-support-copy">
                            <i class="fas fa-boxes-stacked"></i>
                            <div>
                                <strong><%= Common.getBahasaConfig("Login lewat QR sesuai jabatan, tanpa biaya perangkat") %></strong>
                                <span><%= Common.getBahasaConfig("Tim manajemen (HRD, Payroll, Logistik, Akunting, Produksi, Ekspedisi, dan seterusnya) masuk sesuai peran masing-masing dan hanya melihat modul yang relevan dengan jabatannya -- lihat daftar lengkap modul di bawah.") %></span>
                            </div>
                        </div>
                        <div class="btn-custom-group portal-action-grid mt-3">
                            <a href="#section-modules" class="btn btn-primary shadow-sm">
                                <i class="fas fa-boxes"></i> <%= Common.getBahasaConfig("Lihat Semua Modul Manajemen") %>
                            </a>
                        </div>
                        <div class="portal-support-note">
                            <i class="fas fa-check-circle me-2"></i><%= Common.getBahasaConfig("Setiap Pendaftar punya data modul manajemennya sendiri -- terisolasi rapi dari Pendaftar lain di platform.") %>
                        </div>
                    </div>

                </div>
            </div>
        </div>


        <div id="section-about" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="glass-intro p-4 p-lg-5 text-start mb-0">

                    <div class="text-center mb-5">
                        <h2 class="fw-bold mb-3" style="color: var(--primary-color);">
                            <i class="fas fa-network-wired me-2"></i><%= Common.getBahasaConfig("ebisnis.id: Pusat Data dan API Terintegrasi") %>
                        </h2>
                        <p class="text-secondary mx-auto" style="max-width: 850px; line-height: 1.8; font-size: 1.05rem;">
                            <%= Common.getBahasaConfig("ebisnis.id dibangun di atas fondasi teknologi yang sudah terbukti melayani ribuan transaksi harian -- kini dikemas sebagai platform SaaS multi-tenant yang bisa didaftar siapa saja, kapan saja, tanpa perlu tim IT sendiri.") %>
                        </p>
                    </div>

                    <div class="row g-4 mb-4">
                        <div class="col-lg-4">
                            <div class="p-4 h-100 shadow-sm" style="background: rgba(255,255,255,0.7); border-radius: 16px; border: 1px solid rgba(13, 110, 253, 0.2);">
                                <div class="text-center mb-3">
                                    <i class="fas fa-cloud" style="font-size: 3rem; color: var(--primary-color);"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-3">
                                    <i class="fas fa-server text-primary me-2"></i><%= Common.getBahasaConfig("Pusat Data Terpusat") %>
                                </h5>
                                <p class="text-secondary mb-0" style="line-height: 1.7; text-align: justify;">
                                    <%= Common.getBahasaConfig("Setiap Pendaftar punya ruang datanya sendiri yang terisolasi rapi -- brand, toko, transaksi, karyawan, dan laporan keuangan tidak pernah tercampur dengan pelanggan lain di platform yang sama.") %>
                                </p>
                            </div>
                        </div>

                        <div class="col-lg-4">
                            <div class="p-4 h-100 shadow-sm" style="background: rgba(255,255,255,0.7); border-radius: 16px; border: 1px solid rgba(13, 110, 253, 0.2);">
                                <div class="text-center mb-3">
                                    <i class="fas fa-plug" style="font-size: 3rem; color: var(--primary-color);"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-3">
                                    <i class="fas fa-code text-primary me-2"></i><%= Common.getBahasaConfig("API Terintegrasi") %>
                                </h5>
                                <p class="text-secondary mb-0" style="line-height: 1.7; text-align: justify;">
                                    <%= Common.getBahasaConfig("Semua fungsi inti -- katalog, transaksi, stok, laporan -- tersedia lewat API berversi. Aplikasi Desktop dan Mobile berbicara ke server yang sama persis, sehingga tidak ada data yang berbeda antar perangkat.") %>
                                </p>
                            </div>
                        </div>

                        <div class="col-lg-4">
                            <div class="p-4 h-100 shadow-sm" style="background: rgba(255,255,255,0.7); border-radius: 16px; border: 1px solid rgba(13, 110, 253, 0.2);">
                                <div class="text-center mb-3">
                                    <i class="fas fa-layer-group" style="font-size: 3rem; color: var(--primary-color);"></i>
                                </div>
                                <h5 class="fw-bold text-dark mb-3">
                                    <i class="fas fa-puzzle-piece text-primary me-2"></i><%= Common.getBahasaConfig("Strategi Bertahap") %>
                                </h5>
                                <p class="text-secondary mb-0" style="line-height: 1.7; text-align: justify;">
                                    <%= Common.getBahasaConfig("Dikembangkan dengan pola strangler -- fondasi POS yang sudah teruji dipertahankan sebagai inti, sementara layanan baru (tenant, identitas, billing, sinkronisasi) dibangun bertahap di atasnya.") %>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="highlight-cta mt-4">
                        <h4><%= Common.getBahasaConfig("Jangan Tunda Lagi!") %></h4>
                        <p class="mb-0 fs-5 fw-medium">
                            <%= Common.getBahasaConfig("Mulai kelola bisnis Anda dengan lebih tertib bersama ebisnis.id!") %>
                        </p>
                    </div>

                </div>
            </div>
        </div>


        <div id="section-payment" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="glass-intro p-4 p-lg-5 text-start" style="border-left: 6px solid var(--primary-color);">
                    <div class="row align-items-center g-5">
                        <div class="col-lg-7">
                            <h2 class="fw-bold mb-3" style="color: var(--primary-color);">
                                <i class="fas fa-wallet me-2"></i><%= Common.getBahasaConfig("Pembayaran Langganan via Smartlink") %>
                            </h2>
                            <p class="text-secondary" style="line-height: 1.8; text-align: justify; font-size: 1.05rem;">
                                <%= Common.getBahasaConfig("Perpanjangan langganan mesin kasir diproses lewat Smartlink -- gateway pembayaran yang sama, sudah teruji, dan dipakai jutaan transaksi di ekosistem Zishof. Callback pembayaran hanya mengaktifkan langganan setelah signature, nominal, dan status tervalidasi -- tidak pernah mengandalkan halaman redirect semata sebagai bukti bayar.") %>
                            </p>

                            <h5 class="fw-bold text-dark mt-4 mb-3"><%= Common.getBahasaConfig("Kanal Pembayaran yang Didukung:") %></h5>
                            <ul class="list-unstyled text-secondary" style="line-height: 1.8; font-size: 1.05rem;">
                                <li class="mb-2">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    <strong><%= Common.getBahasaConfig("Transfer Virtual Account:") %></strong> <%= Common.getBahasaConfig("BCA, Mandiri, BNI, BRI, BSI, Permata, Danamon, dan CIMB Niaga.") %>
                                </li>
                                <li class="mb-2">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    <strong><%= Common.getBahasaConfig("QRIS & Dompet Digital (E-Wallet):") %></strong> <%= Common.getBahasaConfig("Mendukung pemindaian QRIS terpusat untuk aplikasi GoPay, OVO, DANA, ShopeePay, LinkAja, dan lainnya.") %>
                                </li>
                                <li class="mb-2">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    <strong><%= Common.getBahasaConfig("Gerai Ritel Modern:") %></strong> <%= Common.getBahasaConfig("Pembayaran tunai melalui jaringan Alfamart dan Indomaret.") %>
                                </li>
                                <li class="mb-2">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    <strong><%= Common.getBahasaConfig("Kartu Kredit & Debit:") %></strong> <%= Common.getBahasaConfig("Mendukung transaksi aman melalui jaringan VISA, Mastercard, dan JCB.") %>
                                </li>
                                <li class="mb-2">
                                    <i class="fas fa-check-circle text-success me-2"></i>
                                    <strong><%= Common.getBahasaConfig("Transfer Bank Manual:") %></strong> <%= Common.getBahasaConfig("Tersedia sebagai opsi fleksibilitas pelunasan konvensional.") %>
                                </li>
                            </ul>
                        </div>
                        
                        <div class="col-lg-5 text-center">
                            <div class="payment-gateway-wrapper p-4" style="background: rgba(255,255,255,0.7); border-radius: 16px; border: 1px dashed rgba(13, 110, 253, 0.4);">
                                <i class="fas fa-shield-alt fa-3x text-success mb-3"></i>
                                <h4 class="fw-bold text-dark mb-4"><%= Common.getBahasaConfig("Transaksi Aman & Otomatis") %></h4>
                                
                                <div class="d-flex flex-wrap justify-content-center gap-2">
                                    <span class="badge bg-primary fs-6 py-2 px-3 shadow-sm">
                                        <i class="fas fa-university me-1"></i> Virtual Account
                                    </span>
                                    <span class="badge bg-info text-dark fs-6 py-2 px-3 shadow-sm">
                                        <i class="fas fa-qrcode me-1"></i> QRIS
                                    </span>
                                    <span class="badge bg-warning text-dark fs-6 py-2 px-3 shadow-sm">
                                        <i class="fas fa-wallet me-1"></i> E-Wallet
                                    </span>
                                    <span class="badge bg-danger fs-6 py-2 px-3 shadow-sm">
                                        <i class="fas fa-store me-1"></i> Gerai Ritel
                                    </span>
                                    <span class="badge bg-secondary fs-6 py-2 px-3 shadow-sm">
                                        <i class="fas fa-credit-card me-1"></i> Kartu Kredit/Debit
                                    </span>
                                </div>
                                
                                <p class="text-muted mt-4 mb-0 text-sm" style="line-height: 1.6;">
                                    <%= Common.getBahasaConfig("Seluruh riwayat transaksi langsung tersinkronisasi dengan modul Finance dan Akuntansi institusi tanpa perlu verifikasi manual.") %>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        

        <div id="section-hardware" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="glass-intro p-4 p-lg-5 text-start" style="border-left: 6px solid #10b981;">
                    <div class="row align-items-center g-5">
                        <div class="col-lg-7">
                            <div class="d-flex align-items-center mb-3">
                                <span class="badge bg-danger rounded-pill px-3 py-2 me-3 fs-6 shadow-sm">
                                    <i class="fas fa-fire me-1"></i> Penawaran Khusus
                                </span>
                                <h2 class="fw-bold mb-0" style="color: #059669;">
                                    <i class="fas fa-cash-register me-2"></i><%= Common.getBahasaConfig("Hardware POS DUAL") %>
                                </h2>
                            </div>
                            
                            <p class="text-secondary" style="line-height: 1.8; text-align: justify; font-size: 1.05rem;">
                                <%= Common.getBahasaConfig("Kami menyediakan solusi perangkat keras (hardware) unggulan untuk mendukung transaksi Point of Sale (POS) di toko, gerai, cafe, atau bisnis retail Anda. Spesifikasi ANFO POS DUAL ini dirancang dengan standar industri yang menjamin keandalan penggunaan jangka panjang -- opsional, di luar biaya langganan mesin bulanan.") %>
                            </p>

                            <div class="row mt-4 text-secondary" style="font-size: 0.95rem;">
                                <div class="col-md-6 mb-3">
                                    <h6 class="fw-bold text-dark"><i class="fas fa-microchip text-success me-2"></i>Spesifikasi Utama (CPU)</h6>
                                    <ul class="list-unstyled mt-2" style="line-height: 1.7;">
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Layar Kasir:</strong> 15.6 Inch Touchscreen</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Layar Pelanggan:</strong> 10 Inch Non Touchscreen</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Processor:</strong> Intel Core i3-10110U (2C/4T, 4M Cache, 2.1GHz - 4.1GHz)</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Graphics:</strong> Intel UHD Graphics (Base 300MHz, Max 1000MHz)</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>TDP:</strong> 15 W</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Memory:</strong> 16GB DDR4 Dual Channel (2x 8GB) Max 64GB</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Audio:</strong> HDA CODEC</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Storage:</strong> 512GB SSD</li>
                                    </ul>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <h6 class="fw-bold text-dark"><i class="fas fa-print text-success me-2"></i>Printer & Cash Drawer</h6>
                                    <ul class="list-unstyled mt-2" style="line-height: 1.7;">
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Tipe Printer:</strong> Thermal Line Printing</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Print Speed:</strong> 90mm/s</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Lebar Cetakan:</strong> Max 80 mm (376 dot)</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Lebar Kertas:</strong> 79,5 +/- 0,5 mm</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Emulation:</strong> ESC/POS Command</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Interface:</strong> USB + Bluetooth 3.0, 4.0, 4.1, 4.2</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Laci Kasir (Drawer):</strong> RJ-11 MERK VSC</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Dimensi Laci:</strong> 49 x 48 x 16 cm (3 posisi anak kunci)</li>
                                        <li><i class="fas fa-angle-right text-muted me-2"></i><strong>Slot:</strong> 6 Slot Uang Kertas & 4 Slot Uang Logam</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div class="alert alert-success py-3 px-4 shadow-sm border-0 mt-2" style="background-color: #ecfdf5; border-left: 5px solid #10b981 !important;">
                                <h6 class="fw-bold text-dark mb-2"><i class="fas fa-info-circle text-success me-2"></i>Ketentuan Pengadaan Hardware POS</h6>
                                <p class="mb-0 small text-muted text-justify">Pengadaan Hardware ini bersifat <strong>opsional</strong> dan di luar skema sewa Software. Belum termasuk Pajak & Ongkir luar Jabodetabek. <strong>Syarat: DP Rp 30 Juta di awal, proses manufaktur kurang lebih 1 bulan.</strong></p>
                            </div>
                        </div>
                        
                        <div class="col-lg-5 text-center">
                            <div class="row g-3 mb-3">
                                <div class="col-12">
                                    <img 
                                        src="<%=Common.ROOT%>/img/pos1.jpg" 
                                        alt="Mesin POS Gambar 1" 
                                        class="img-fluid rounded-4 shadow border border-white border-3 hover-zoom" 
                                        style="height: 250px; width: 100%; object-fit: cover;" 
                                        onclick="showImageModal(this.src)" 
                                        onerror="this.style.display='none'"
                                    >
                                </div>
                                <div class="col-12">
                                    <img 
                                        src="<%=Common.ROOT%>/img/pos2.jpg" 
                                        alt="Mesin POS Gambar 2" 
                                        class="img-fluid rounded-4 shadow border border-white border-3 hover-zoom" 
                                        style="height: 250px; width: 100%; object-fit: cover;" 
                                        onclick="showImageModal(this.src)" 
                                        onerror="this.style.display='none'"
                                    >
                                </div>
                            </div>
                            <div class="text-center small text-muted fst-italic">
                                <i class="fas fa-search-plus me-1"></i> Klik gambar untuk memperbesar
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>


        <div id="section-modules" class="mb-5 pb-4 mt-2">
            <div class="text-center mb-5">
                <div class="section-eyebrow">
                    <i class="fas fa-boxes"></i><%= Common.getBahasaConfig("Modul Manajemen") %>
                </div>
                <h2 class="section-heading-premium"><%= Common.getBahasaConfig("Setiap Pendaftar Punya Modul Manajemen Lengkap Sendiri") %></h2>
                <p class="section-lead-premium mb-0">
                    <%= Common.getBahasaConfig("Selain toko/brand/mesin kasir, setiap Pendaftar juga memiliki rangkaian modul Manajemen berikut -- data tiap modul terpisah rapi per Pendaftar, tidak pernah tercampur dengan Pendaftar lain di platform.") %>
                </p>
            </div>

            <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4 justify-content-center">

                <div class="col">
                    <div class="feature-card" style="border-top: 4px solid var(--primary-color);">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-users fa-2x" style="color: var(--primary-color);"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-users text-primary"></i><%= Common.getBahasaConfig("SDM (HRD)") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Data karyawan, kontrak kerja, jabatan, shift, cuti, dan absensi -- fondasi bagi modul Payroll dan penilaian kinerja.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-money-check-dollar fa-2x text-success"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-money-check-dollar"></i><%= Common.getBahasaConfig("Payroll") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Perhitungan gaji, tunjangan, potongan, dan slip gaji otomatis berdasarkan data SDM dan kehadiran -- terhubung langsung ke jurnal Akunting.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-truck-fast fa-2x text-warning"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-truck-fast"></i><%= Common.getBahasaConfig("Logistik") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Pengadaan barang, distribusi antar toko/gudang, dan koordinasi pasokan lintas brand dalam satu Pendaftar yang sama.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-envelope-open-text fa-2x" style="color: #6d28d9;"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-envelope-open-text"></i><%= Common.getBahasaConfig("Surat Menyurat") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Pencatatan surat masuk/keluar, disposisi, nomor surat anti-duplikat, dan arsip digital untuk kebutuhan administrasi internal.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-diagram-project fa-2x text-info"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-diagram-project"></i><%= Common.getBahasaConfig("Workflow") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Alur persetujuan berjenjang (approval) untuk pengajuan, pengadaan, cuti, dan proses internal lain sesuai struktur organisasi Anda.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-calculator fa-2x" style="color: #059669;"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-calculator"></i><%= Common.getBahasaConfig("Akunting") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Posting jurnal otomatis dari transaksi penjualan, pembelian, dan payroll -- neraca, laba rugi, dan buku besar tersaji tanpa entri manual berulang.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-chart-line fa-2x" style="color: #0284c7;"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-chart-line"></i><%= Common.getBahasaConfig("Finance") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Arus kas, piutang, utang, rekonsiliasi bank, dan anggaran -- dipantau lintas toko/brand dari satu dashboard keuangan.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-boxes-stacked fa-2x text-danger"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-boxes-stacked"></i><%= Common.getBahasaConfig("Aset & Inventaris") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Pendataan aset tetap, penyusutan, pengadaan barang inventaris, dan pelacakan lokasi/penanggung jawab aset di tiap toko.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-industry fa-2x" style="color: #78350f;"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-industry"></i><%= Common.getBahasaConfig("Produksi") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Resep/BOM, perhitungan HPP otomatis, perintah produksi, dan pelacakan bahan baku untuk bisnis manufaktur/kuliner.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-truck fa-2x" style="color: #b45309;"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-truck"></i><%= Common.getBahasaConfig("Ekspedisi") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Pengiriman barang antar toko/gudang atau ke pelanggan, manifest pengiriman, dan bukti serah terima digital.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-map-location-dot fa-2x text-primary"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-map-location-dot"></i><%= Common.getBahasaConfig("Pelacakan Kendaraan Ekspedisi") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Pemantauan lokasi kendaraan pengiriman secara langsung, estimasi waktu tiba, dan riwayat rute perjalanan.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-van-shuttle fa-2x" style="color: #0d9488;"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-van-shuttle"></i><%= Common.getBahasaConfig("Antar Jemput") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Penjadwalan dan pemantauan layanan antar jemput karyawan/pelanggan, lengkap dengan status kedatangan.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-user-shield fa-2x text-dark"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-user-shield"></i><%= Common.getBahasaConfig("Audit & Pengawasan Internal") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("Program audit internal, temuan berbobot risiko, dan tindak lanjut yang terpantau -- menarik data langsung dari modul keuangan, aset, dan operasional lain.") %>
                        </p>
                    </div>
                </div>

                <div class="col">
                    <div class="feature-card">
                        <div class="module-icon-box mb-3 text-center"><i class="fas fa-ellipsis fa-2x text-secondary"></i></div>
                        <h4 class="feature-title">
                            <i class="fas fa-ellipsis"></i><%= Common.getBahasaConfig("Dan Modul Lainnya") %>
                        </h4>
                        <p class="feature-text">
                            <%= Common.getBahasaConfig("CRM, Purchasing, Gudang & Inventory Control, Shipping, hingga modul ERP lain terus dikembangkan bertahap mengikuti kebutuhan lini bisnis Anda.") %>
                        </p>
                    </div>
                </div>

            </div>
        </div>



        <div id="section-daftar" class="row justify-content-center mb-5">
            <div class="col-lg-12 col-xl-11">
                <div class="premium-card p-4 p-lg-5">
                    <div class="text-center position-relative mb-4">
                        <div class="section-eyebrow">
                            <i class="fas fa-user-plus"></i><%= Common.getBahasaConfig("Daftar / Masuk") %>
                        </div>
                        <h2 class="section-heading-premium">
                            <%= Common.getBahasaConfig("Mulai Kelola Bisnis Anda Sekarang") %>
                        </h2>
                        <p class="section-lead-premium mb-0">
                            <%= Common.getBahasaConfig("Pendaftar baru, klik Daftar Sekarang. Sudah punya akun? Klik Masuk.") %>
                        </p>
                    </div>

                    <div id="ebisnisFlashArea">
                    <% if (flashPesan != null) { %>
                        <div class="alert <%= "sukses".equals(flashJenis) ? "alert-success" : "alert-danger" %> text-center" role="alert">
                            <%= StringEscapeUtils.escapeHtml(flashPesan) %>
                        </div>
                    <% } %>
                    </div>

                    <% if (sudahLoginPendaftar) { %>
                        <div class="text-center py-5">
                            <i class="fas fa-circle-check fa-4x text-success mb-3"></i>
                            <h4 class="fw-bold"><%= Common.getBahasaConfig("Anda sudah masuk sebagai") %> <%= StringEscapeUtils.escapeHtml(sesiPendaftarNama) %></h4>
                            <p class="text-secondary"><%= Common.getBahasaConfig("Kelola Brand, Toko, Mesin POS, Investor, dan Manajemen dari Dashboard Anda.") %></p>
                            <a href="<%=request.getContextPath()%>/EbisnisPublic" class="btn btn-primary px-5 py-2 fw-bold me-2">
                                <i class="fas fa-gauge me-2"></i><%= Common.getBahasaConfig("Buka Dashboard") %>
                            </a>
                            <form method="post" action="<%=request.getContextPath()%>/EbisnisPublic" class="d-inline">
                                <input type="hidden" name="aksi" value="logout">
                                <button type="submit" class="btn btn-outline-secondary"><i class="fas fa-right-from-bracket me-2"></i><%= Common.getBahasaConfig("Keluar") %></button>
                            </form>
                        </div>
                    <% } else { %>
                    <div class="text-center py-5">
                        <div class="row g-4 justify-content-center">
                            <div class="col-md-5">
                                <div class="h-100 p-4 border rounded-4">
                                    <i class="fas fa-store fa-3x text-primary mb-3"></i>
                                    <h4 class="fw-bold"><%= Common.getBahasaConfig("Pendaftar Baru") %></h4>
                                    <p class="text-secondary"><%= Common.getBahasaConfig("Daftarkan bisnis Anda dan mulai uji coba gratis 30 hari.") %></p>
                                    <button type="button" class="btn btn-primary px-5 py-2 fw-bold" data-bs-toggle="modal" data-bs-target="#modalDaftarEbisnis">
                                        <i class="fas fa-rocket me-2"></i><%= Common.getBahasaConfig("Daftar Sekarang") %>
                                    </button>
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="h-100 p-4 border rounded-4">
                                    <i class="fas fa-right-to-bracket fa-3x text-primary mb-3"></i>
                                    <h4 class="fw-bold"><%= Common.getBahasaConfig("Sudah Punya Akun?") %></h4>
                                    <p class="text-secondary"><%= Common.getBahasaConfig("Masuk untuk mengelola Brand, Toko, Mesin POS, Investor, dan Manajemen.") %></p>
                                    <button type="button" class="btn btn-outline-primary px-5 py-2 fw-bold" data-bs-toggle="modal" data-bs-target="#modalMasukEbisnis">
                                        <i class="fas fa-right-to-bracket me-2"></i><%= Common.getBahasaConfig("Masuk") %>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="formal-note-box mt-5 mx-auto" style="max-width: 720px;">
                            <div class="note-title"><i class="fas fa-shield-halved me-2"></i><%= Common.getBahasaConfig("Keamanan Akun Anda") %></div>
                            <p class="note-text">
                                <%= Common.getBahasaConfig("Password disimpan sebagai hash satu arah (PBKDF2-SHA256) dengan salt acak per akun -- kami tidak pernah menyimpan password Anda dalam bentuk yang bisa dibaca ulang.") %>
                            </p>
                        </div>
                    </div>
                    <% } %>
                </div>
            </div>
        </div>

        <!-- Modal: Daftar Pendaftar Baru -->
        <div class="modal fade" id="modalDaftarEbisnis" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold"><i class="fas fa-store me-2 text-primary"></i><%= Common.getBahasaConfig("Daftar Sebagai Pendaftar Baru") %></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="ebisnis-modal-alert"></div>
                        <form id="formDaftarEbisnis" data-aksi="daftar">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Nama Bisnis / Toko / Perusahaan") %> *</label>
                                    <input type="text" name="namaBisnis" class="form-control" required maxlength="255">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Jenis Bisnis") %></label>
                                    <input type="text" name="jenisBisnis" class="form-control" placeholder="<%= Common.getBahasaConfig("mis. Kafe, Retail, Distributor") %>" maxlength="255">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><%= Common.getBahasaConfig("Negara") %></label>
                                    <input type="text" name="negara" class="form-control" value="Indonesia" maxlength="100">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><%= Common.getBahasaConfig("Provinsi") %></label>
                                    <input type="text" name="provinsi" class="form-control" maxlength="100">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><%= Common.getBahasaConfig("Kota / Kabupaten") %></label>
                                    <input type="text" name="kotaKabupaten" class="form-control" maxlength="100">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label"><%= Common.getBahasaConfig("Kecamatan") %></label>
                                    <input type="text" name="kecamatan" class="form-control" maxlength="100">
                                </div>
                                <div class="col-12">
                                    <label class="form-label"><%= Common.getBahasaConfig("Alamat Lengkap") %></label>
                                    <input type="text" name="alamat" class="form-control" maxlength="255">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Nama Kontak Person (PIC)") %></label>
                                    <input type="text" name="kontakPerson" class="form-control" maxlength="255">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Telepon/WA Kontak Person") %></label>
                                    <input type="text" name="telpKontakPerson" class="form-control" maxlength="50">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Telepon Bisnis") %></label>
                                    <input type="text" name="telp" class="form-control" maxlength="50">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Email (untuk Login)") %> *</label>
                                    <input type="email" name="email" class="form-control" required maxlength="255">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Password") %> *</label>
                                    <input type="password" name="password" class="form-control" required minlength="6">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label"><%= Common.getBahasaConfig("Konfirmasi Password") %> *</label>
                                    <input type="password" name="konfirmasiPassword" class="form-control" required minlength="6">
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary mt-4 px-5 py-2 fw-bold w-100">
                                <i class="fas fa-rocket me-2"></i><%= Common.getBahasaConfig("Daftar Sekarang") %>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Masuk (login) -->
        <div class="modal fade" id="modalMasukEbisnis" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold"><i class="fas fa-right-to-bracket me-2 text-primary"></i><%= Common.getBahasaConfig("Masuk ke Akun Anda") %></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="ebisnis-modal-alert"></div>
                        <form id="formMasukEbisnis" data-aksi="login">
                            <div class="mb-3">
                                <label class="form-label"><%= Common.getBahasaConfig("Email") %></label>
                                <input type="email" name="email" class="form-control" required maxlength="255">
                            </div>
                            <div class="mb-3">
                                <label class="form-label"><%= Common.getBahasaConfig("Password") %></label>
                                <input type="password" name="password" class="form-control" required>
                            </div>
                            <button type="submit" class="btn btn-outline-primary px-5 py-2 fw-bold w-100">
                                <i class="fas fa-right-to-bracket me-2"></i><%= Common.getBahasaConfig("Masuk") %>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <script>
        (function () {
            function tampilkanAlert(modalBody, jenis, pesan) {
                var area = modalBody.querySelector('.ebisnis-modal-alert');
                area.innerHTML = '<div class="alert alert-' + (jenis === 'sukses' ? 'success' : 'danger') + ' text-center">' + pesan + '</div>';
            }

            function kirimForm(form) {
                var modalBody = form.closest('.modal-body');
                var tombol = form.querySelector('button[type="submit"]');
                var teksAsli = tombol.innerHTML;
                tombol.disabled = true;
                tombol.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i><%= Common.getBahasaConfig("Memproses...") %>';

                var payload = new URLSearchParams(new FormData(form));
                payload.append('aksi', form.getAttribute('data-aksi'));
                payload.append('ajax', '1');

                fetch('<%=request.getContextPath()%>/EbisnisPublic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    credentials: 'include',
                    body: payload.toString()
                }).then(function (r) { return r.json(); }).then(function (hasil) {
                    tombol.disabled = false;
                    tombol.innerHTML = teksAsli;
                    if (hasil.status === '00') {
                        tampilkanAlert(modalBody, 'sukses', hasil.description);
                        window.location.href = hasil.redirect || '<%=request.getContextPath()%>/EbisnisPublic';
                    } else {
                        tampilkanAlert(modalBody, 'error', hasil.description);
                    }
                }).catch(function () {
                    tombol.disabled = false;
                    tombol.innerHTML = teksAsli;
                    tampilkanAlert(modalBody, 'error', '<%= Common.getBahasaConfig("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.") %>');
                });
            }

            ['formDaftarEbisnis', 'formMasukEbisnis'].forEach(function (id) {
                var form = document.getElementById(id);
                if (!form) { return; }
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    if (form.getAttribute('data-aksi') === 'daftar') {
                        var pw = form.querySelector('[name="password"]').value;
                        var pw2 = form.querySelector('[name="konfirmasiPassword"]').value;
                        if (pw !== pw2) {
                            tampilkanAlert(form.closest('.modal-body'), 'error', '<%= Common.getBahasaConfig("Konfirmasi password tidak sama.") %>');
                            return;
                        }
                    }
                    kirimForm(form);
                });
            });
        })();
        </script>

    </main>

    <a href="#section-daftar" class="sticky-cta-floating">
        <i class="fas fa-rocket fs-4"></i><span><%= Common.getBahasaConfig("Daftar Sekarang") %></span>
    </a>

    <footer class="footer-custom shadow-lg">
        <div class="container">
            <div class="row text-center text-md-start">
                
                <div class="col-md-5 col-lg-4 mb-4">
                    <h5 class="text-uppercase">
                        <i class="fas fa-store me-2 text-info"></i> <%=judulHeader%>
                    </h5>
                    <p class="text-sm mt-3 pe-md-4" style="line-height: 1.8;">
                        <%= Common.getBahasaConfig("Platform SaaS POS dan ERP retail/manufaktur terintegrasi, didedikasikan untuk membantu bisnis Anda tumbuh dari satu mesin kasir menjadi ekosistem") %> <strong class="text-white"><%=judul%></strong>.
                    </p>
                </div>

                <div class="col-md-3 col-lg-4 mb-4 text-center">
                    <h5 class="text-uppercase"><%= Common.getBahasaConfig("Unduh Aplikasi Kasir") %></h5>
                    <div class="d-flex flex-column align-items-center mt-4 gap-3">
                        <a href="#section-daftar" class="footer-link d-flex align-items-center bg-dark p-3 rounded-3 border border-secondary w-100 justify-content-center" style="max-width: 250px;">
                            <i class="fab fa-android me-2"></i>
                            <span class="ms-1 fw-semibold"><%= Common.getBahasaConfig("Android (via Daftar)") %></span>
                        </a>
                        <a href="#section-daftar" class="footer-link d-flex align-items-center bg-dark p-3 rounded-3 border border-secondary w-100 justify-content-center" style="max-width: 250px;">
                            <i class="fab fa-windows me-2"></i>
                            <span class="ms-1 fw-semibold"><%= Common.getBahasaConfig("Windows (via Daftar)") %></span>
                        </a>
                    </div>
                </div>

                <div class="col-md-4 col-lg-4 mb-4">
                    <h5 class="text-uppercase"><%= Common.getBahasaConfig("Informasi Kontak") %></h5>
                    <ul class="list-unstyled mt-4">
                        <li class="mb-3 d-flex align-items-center text-start">
                            <i class="fas fa-envelope contact-icon me-3 fs-5"></i>
                            <span>zishof@gmail.com</span>
                        </li>
                    </ul>
                </div>
            </div>

            <hr class="border-secondary mt-5 mb-4 opacity-25">

            <div class="row align-items-center">
                <div class="col-md-6 text-center text-md-start mb-4 mb-md-0">
                    <small>
                        &copy; <%=Calendar.getInstance().get(Calendar.YEAR) %> <%=judulHeader%> - <%=judul%>. <%= Common.getBahasaConfig("Seluruh Hak Cipta Dilindungi.") %>
                    </small>
                </div>
                <div class="col-md-6 text-center text-md-end">
                    <a target="_blank" href="https://info.flagcounter.com/lOr6">
                        <img 
                            src="https://s11.flagcounter.com/count2/lOr6/bg_0F172A/txt_CBD5E0/border_38BDF8/columns_2/maxflags_6/viewers_0/labels_0/pageviews_0/flags_0/percent_0/" 
                            alt="Flag Counter" 
                            class="img-fluid rounded border border-info border-opacity-25 opacity-75 hover-opacity-100 transition-opacity"
                        >
                    </a>
                </div>
            </div>
        </div>
    </footer>

    <div class="modal fade" id="imageModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content bg-transparent border-0">
          <div class="modal-header border-0 pb-0 justify-content-end">
            <button 
                type="button" 
                class="btn-close btn-close-white" 
                data-bs-dismiss="modal" 
                aria-label="Close" 
                style="filter: invert(1) grayscale(100%) brightness(200%);"
            ></button>
          </div>
          <div class="modal-body text-center p-0">
            <img 
                id="modalExpandedImage" 
                src="" 
                class="img-fluid rounded-4 shadow-lg" 
                alt="Expanded Hardware Image" 
                style="max-height: 85vh; width: auto;"
            >
          </div>
        </div>
      </div>
    </div>

    <script src="<%=request.getContextPath() %>/js/pesan-formal.js"></script>
    <script data-cfasync="false" src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Logika untuk mendeteksi scroll dan menyorot menu navigasi yang sedang aktif
            const navLinks = document.querySelectorAll('.custom-nav-link');
            const sections = document.querySelectorAll('div[id^="section-"]');

            window.addEventListener('scroll', () => {
                let current = '';
                sections.forEach(section => {
                    const sectionTop = section.offsetTop;
                    if (scrollY >= sectionTop - 150) {
                        current = section.getAttribute('id');
                    }
                });

                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').includes(current)) {
                        link.classList.add('active');
                    }
                });
            });

            // ========================================================================================
            // KAMUS DATA MODUL LENGKAP
            // Dictionary ini menyimpan semua informasi spesifik untuk masing-masing modul ERP
            // ========================================================================================
            const moduleDict = {
                "login_ecampus": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Login eCampus") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul portal autentikasi terpusat yang menjadi pintu gerbang utama bagi seluruh pengguna untuk memasuki ekosistem digital institusi pendidikan tinggi. Dilengkapi antarmuka spesifik (Multi-Portal) yang didesain terpisah untuk kebutuhan Dosen, Mahasiswa, maupun Orang Tua/Wali.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Memastikan keamanan privasi data sekaligus memberikan kemudahan akses instan ke seluruh layanan akademik dan administratif.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Ditenagai oleh teknologi enkripsi mutakhir dengan dukungan Single Sign-On (SSO) untuk sinkronisasi antarmodul secara menyeluruh.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Memvalidasi identitas pengguna, mengelola sesi login, dan mendistribusikan hak akses sesuai dengan struktur organisasi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Mahasiswa, Dosen, Tenaga Kependidikan, Orang Tua, dan Pimpinan Institusi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Sistem Login eCampus memberikan fondasi keamanan yang solid dan kemudahan akses tak terbatas untuk memaksimalkan produktivitas seluruh entitas akademik melalui portal yang dipersonalisasi.") %>',
                    requireLogin: true
                },
                "pelaporan": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Sinkronisasi Pelaporan Nasional") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul integrasi cerdas yang menjembatani database institusi dengan sistem pelaporan akademik tingkat kementerian, seperti PDDIKTI Neo Feeder dan EMIS Kemenag.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Membebaskan operator kampus dari kewajiban melakukan entri data ganda (double-entry) yang memakan waktu dan berisiko memunculkan perbedaan (discrepancy) data.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Proses sinkronisasi otomatis menggunakan metode 1-Click Sync API yang dikurasi khusus agar 100% kompatibel dengan struktur web service dikti/kemenag terbaru.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mentransmisikan data riwayat mahasiswa, rekapitulasi nilai, aktivitas dosen, hingga beban mengajar langsung ke sistem pusat secara masif dan akurat.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Operator PDDIKTI, Admin EMIS, dan Pimpinan Bagian Akademik.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menjamin kepatuhan administrasi dan validitas data institusi Anda di tingkat nasional secara seketika, cerdas, dan efisien tanpa kompromi.") %>',
                    requireLogin: false
                },
                "tracer_study": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Pelacakan Alumni (Tracer Study)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Fasilitas komprehensif untuk melacak dan mengevaluasi jejak karir serta tingkat penyerapan lulusan di dunia kerja profesional.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Menyediakan data empiris yang krusial untuk evaluasi relevansi kurikulum pendidikan terhadap kebutuhan industri pasar saat ini.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Instrumen kuesioner yang dapat dikustomisasi sepenuhnya dengan kapabilitas analitik dan visualisasi data yang responsif.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mendistribusikan survei secara masif, merekam respons alumni, dan memetakan profil karir untuk keperluan pelaporan akreditasi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Alumni, Unit Pengelola Karir Institusi, dan Badan Akreditasi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mendukung institusi dalam memetakan tingkat kesuksesan alumni di dunia kerja untuk dasar peningkatan mutu kurikulum berkelanjutan.") %>',
                    requireLogin: false
                },
                "pmb": {
                    title: '<%= Common.getBahasaConfigJS("Penerimaan Mahasiswa Baru (PMB)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem otomasi untuk mengelola seluruh siklus penerimaan peserta didik baru, dari tahap registrasi awal hingga proses daftar ulang.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meningkatkan efisiensi kerja panitia penerimaan sekaligus memberikan pengalaman pendaftaran yang intuitif bagi para calon mahasiswa.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Mendukung integrasi pembayaran daring (Payment Gateway), seleksi berbasis komputer (CBT), serta notifikasi status secara real-time.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mengelola formulir pendaftaran, memverifikasi dokumen prasyarat, menyelenggarakan ujian seleksi, dan mengumumkan hasil akhir.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Calon Mahasiswa Baru, Orang Tua/Wali, dan Panitia PMB.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menghadirkan proses seleksi dan pendaftaran calon mahasiswa baru yang mutakhir, efisien, dan transparan bagi semua pihak.") %>',
                    requireLogin: false
                },
                "dokumen": {
                    title: '<%= Common.getBahasaConfigJS("Manajemen Dokumen & Persuratan") %>',
                    desc: '<%= Common.getBahasaConfigJS("Repositori digital terpusat yang dirancang khusus untuk mengelola, menyimpan, dan melacak seluruh arsip serta surat-menyurat resmi institusi.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mengeliminasi penggunaan kertas (paperless), mempercepat proses pencarian arsip lampau, dan meminimalisasi risiko kehilangan dokumen vital.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Sistem alur persetujuan (approval workflow) bertingkat yang fleksibel dengan dukungan tanda tangan elektronik terotentikasi.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mendokumentasikan surat masuk/keluar, mengelola hak akses baca, serta memfasilitasi disposisi tugas antardepartemen.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Pimpinan Institusi, Staf Kesekretariatan, dan Tenaga Administrasi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Digitalisasi persuratan menjamin keamanan tata kelola arsip, menghemat ruang fisik, dan mempercepat alur birokrasi institusi.") %>',
                    requireLogin: false
                },
                "dashboard": {
                    title: '<%= Common.getBahasaConfigJS("Executive Dashboard (Dasbor Eksekutif)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Panel visualisasi data tingkat tinggi yang menyajikan ringkasan informasi strategis dan performa operasional institusi secara real-time.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mempercepat proses pengambilan keputusan strategis di tingkat pimpinan berbasiskan data faktual (data-driven decision making).") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Tampilan infografis yang interaktif, indikator kinerja utama (KPI) yang komprehensif, dan kemampuan penelusuran data yang mendalam.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Memonitor metrik krusial seperti statistik demografi, serapan anggaran keuangan, dan pencapaian target akademik secara presisi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Rektor, Ketua Yayasan, Dekan, dan Jajaran Manajemen Tingkat Atas.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menyediakan pusat informasi analitik terpadu bagi pimpinan eksekutif guna menunjang akurasi pengambilan keputusan manajerial.") %>',
                    requireLogin: false
                },
                "pustaka": {
                    title: '<%= Common.getBahasaConfigJS("Perpustakaan Digital (E-Library)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Platform manajemen perpustakaan modern yang mengotomatisasi sirkulasi literatur fisik dan menyediakan akses ke koleksi literatur digital secara luas.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meningkatkan literasi sivitas akademika dengan memberikan akses referensi bahan ajar yang cepat, mudah, dan tidak terbatas ruang.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Terintegrasi dengan Online Public Access Catalog (OPAC), sistem pemindaian sirkulasi kode batang (barcode), dan automasi denda.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mengelola inventaris buku, memfasilitasi proses peminjaman/pengembalian, serta menerbitkan surat keterangan bebas pustaka.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Mahasiswa, Dosen, Peneliti, dan Staf Kepustakaan.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mendorong tingkat literasi sivitas akademika melalui manajemen tata kelola perpustakaan yang modern, responsif, dan kaya referensi.") %>',
                    requireLogin: false
                },
                "repository": {
                    title: '<%= Common.getBahasaConfigJS("Repositori Karya Ilmiah (E-Repository)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem pengarsipan digital terstruktur untuk menyimpan, melestarikan, dan mendistribusikan karya intelektual yang dihasilkan oleh sivitas akademika.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mencegah praktik plagiarisme, melindungi hak kekayaan intelektual institusi, serta memperluas jangkauan diseminasi hasil riset kepada publik.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Kompatibel dengan standar protokol metadata internasional (seperti DSpace), fitur pencarian spesifik, dan indeksasi publikasi yang handal.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyimpan tesis, disertasi, prosiding, serta artikel jurnal dalam format digital yang terenkripsi dan mudah diklasifikasikan.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Dosen Peneliti, Mahasiswa Akhir, dan Komunitas Akademik Global.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Melestarikan warisan karya intelektual institusi dan memperluas eksistensi publikasi riset di ruang lingkup akademik internasional.") %>',
                    requireLogin: false
                },
                "akreditasi": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Penjaminan Mutu & Akreditasi") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul strategis untuk mengawal pemenuhan standar pendidikan nasional dan mempersiapkan kelengkapan dokumen akreditasi secara sistematis.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meringankan beban administratif saat proses re-akreditasi dan memastikan setiap departemen mematuhi standar mutu yang telah ditetapkan.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Instrumen matriks penilaian yang selalu dimutakhirkan mengikuti pedoman lembaga akreditasi resmi (seperti BAN-PT/LAM).") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menghimpun bukti fisik, mengkalkulasi borang akreditasi, serta memantau progres perbaikan mutu secara berkelanjutan.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Badan Penjaminan Mutu (BPM), Asesor Internal, dan Pimpinan Program Studi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Memastikan budaya kualitas institusi senantiasa terjaga melalui pengawalan standarisasi mutu pendidikan yang terkomputerisasi secara ketat.") %>',
                    requireLogin: false
                },
                "ejournal": {
                    title: '<%= Common.getBahasaConfigJS("Manajemen Jurnal Ilmiah (E-Journal)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Platform tata kelola penerbitan jurnal akademik elektronik, dari tahap penyerahan naskah, tinjauan sejawat (peer-review), hingga tahap publikasi akhir.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mengangkat reputasi akademik institusi dengan memfasilitasi proses publikasi jurnal yang kredibel, terstandarisasi, dan diakui secara global.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Alur kerja redaksional transparan yang mengadaptasi standar Open Journal Systems (OJS) secara penuh.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menerima manuskrip dari penulis, menugaskan peninjau, mengelola revisi, serta menerbitkan edisi jurnal secara berkala.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Penulis Akademik, Dewan Redaksi Jurnal, Reviewer, dan Peneliti.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Meningkatkan prestise dan kontribusi riset institusi melalui tata kelola jurnal keilmuan yang profesional, terakreditasi, dan bereputasi tinggi.") %>',
                    requireLogin: false
                },
                "simlitabmas": {
                    title: '<%= Common.getBahasaConfigJS("Penelitian & Pengabdian Masyarakat (Simlitabmas)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem informasi khusus untuk mengkoordinasikan program tridharma institusi, khususnya dalam bidang riset dan pengabdian kepada masyarakat.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meningkatkan transparansi alokasi dana hibah penelitian dan mempermudah pemantauan luaran (output) proyek secara komprehensif.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Fasilitas pengajuan proposal terstruktur, evaluasi anggaran (RAB), dan peninjauan progres (logbook) yang terpusat.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyeleksi proposal penelitian, mengelola kontrak hibah pendanaan, dan mempublikasikan hasil pengabdian masyarakat.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Lembaga Penelitian (LPPM), Dosen Peneliti, dan Mahasiswa.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mengakselerasi kuantitas serta kualitas program riset dan pengabdian masyarakat melalui manajemen pendanaan hibah yang sangat transparan.") %>',
                    requireLogin: false
                },
                "yayasan": {
                    title: '<%= Common.getBahasaConfigJS("Portal Pengelola Yayasan") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul komando tertinggi yang dirancang khusus bagi entitas pemilik/yayasan untuk memonitor seluruh cabang institusi pendidikan di bawah naungannya secara tersentralisasi.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Memberikan visibilitas menyeluruh terkait stabilitas keuangan, statistik kepegawaian, dan tren demografi siswa dari seluruh unit sekolah tanpa harus hadir secara fisik.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Konsolidasi laporan lintas unit yang disajikan dalam dasbor analitik canggih, memungkinkan perbandingan kinerja antar cabang dengan tingkat akurasi tinggi.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Memantau arus kas yayasan, merumuskan kebijakan anggaran strategis, mengendalikan aset utama, dan mengevaluasi indikator kinerja (KPI) unit pendidikan.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Ketua Yayasan, Dewan Pembina, dan Direktur Operasional.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Memberikan kendali pengawasan mutlak bagi pihak yayasan untuk mengevaluasi, membandingkan, serta mengembangkan seluruh cabang pendidikan secara harmonis.") %>',
                    requireLogin: true
                },
                "admin_tk": {
                    title: '<%= Common.getBahasaConfigJS("Portal Manajemen Sekolah (TK)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem administrasi terpadu yang dirancang untuk mengelola tata operasional Taman Kanak-Kanak secara efisien.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mereduksi beban kerja klerikal staf dan memastikan data perkembangan peserta didik tercatat secara sistematis dan rapi.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Antarmuka yang intuitif serta tersinkronisasi penuh dengan laporan keuangan, penilaian harian, dan modul absensi.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mengelola biodata murid, jadwal kegiatan mengajar, sistem pembayaran SPP, dan penerbitan laporan perkembangan belajar.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Kepala Sekolah TK, Guru Wali Kelas, dan Staf Tata Usaha.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menyederhanakan kompleksitas administrasi pendidikan usia dini agar tenaga pendidik dapat lebih memfokuskan diri pada stimulasi perkembangan esensial anak.") %>',
                    requireLogin: true
                },
                "admin_sd": {
                    title: '<%= Common.getBahasaConfigJS("Portal Manajemen Sekolah (SD)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem administrasi terpadu yang dirancang untuk mengelola tata operasional Sekolah Dasar secara efisien dan komprehensif.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mereduksi beban kerja klerikal staf dan memastikan data akademik serta kehadiran peserta didik tercatat secara sistematis.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Antarmuka yang intuitif serta tersinkronisasi penuh dengan laporan keuangan, pengisian e-Rapor, dan modul absensi presisi.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mengelola biodata siswa, jadwal mata pelajaran, sistem penagihan SPP, dan penerbitan buku laporan hasil belajar.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Kepala Sekolah SD, Guru Kelas, dan Staf Tata Usaha.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mengintegrasikan fungsionalitas manajemen akademik dan manajerial secara utuh guna menciptakan pondasi lingkungan pendidikan dasar yang solid.") %>',
                    requireLogin: true
                },
                "admin_smp": {
                    title: '<%= Common.getBahasaConfigJS("Portal Manajemen Sekolah (SMP)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem administrasi terpadu yang dirancang untuk mengelola tata operasional Sekolah Menengah Pertama secara modern dan terstruktur.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meningkatkan disiplin data akademik dan mengotomatisasi perhitungan komponen nilai secara akurat tanpa campur tangan manual.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Mendukung manajemen kurikulum yang kompleks, penjadwalan guru bidang studi, serta pemantauan pelanggaran tata tertib siswa.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Merekam absensi, mempublikasikan jadwal ujian, mengelola tagihan keuangan, serta memfasilitasi komunikasi wali murid.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Kepala Sekolah SMP, Guru Bidang Studi, Guru BK, dan Staf Tata Usaha.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mendukung dinamika pendidikan menengah dengan instrumen pengelolaan evaluasi belajar, penagihan, serta pengawasan tingkat kedisiplinan yang tertata rapi.") %>',
                    requireLogin: true
                },
                "admin_sma": {
                    title: '<%= Common.getBahasaConfigJS("Portal Manajemen Sekolah (SMA)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem administrasi tingkat lanjut yang diformulasikan untuk mengelola dinamika operasional Sekolah Menengah Atas beserta sistem penjurusannya.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mempermudah proses peminatan/penjurusan akademik serta memantau kesiapan siswa menuju fase pendidikan tinggi.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Kapasitas pemrosesan data lintas jurusan (IPA/IPS/Bahasa) dan integrasi penilaian berbasis proyek sesuai standar nasional.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyusun rombongan belajar, mendistribusikan transkrip nilai, memantau kegiatan ekstrakurikuler, dan mengelola bimbingan konseling.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Kepala Sekolah SMA, Wakil Kepala Sekolah, Guru Mata Pelajaran, dan Guru BK.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mempersiapkan kematangan akademik siswa menuju jenjang pendidikan tinggi melalui manajemen evaluasi penjurusan yang sangat komprehensif.") %>',
                    requireLogin: true
                },
                "admin_smk": {
                    title: '<%= Common.getBahasaConfigJS("Portal Manajemen Sekolah (SMK)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem pengelolaan vokasi komprehensif yang dirancang secara spesifik untuk memfasilitasi operasional Sekolah Menengah Kejuruan.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Menjembatani manajemen akademik teoritis dengan pengelolaan kegiatan praktik industri secara terpadu di satu platform.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Dilengkapi dengan fasilitas khusus untuk mengelola program magang, inventaris bengkel praktik, dan pencatatan sertifikasi keahlian.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mengelola penempatan Praktik Kerja Lapangan (PKL), memvalidasi laporan magang, serta menyusun nilai produktif kejuruan.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Kepala Sekolah SMK, Ketua Program Keahlian, Pembimbing PKL, dan Siswa Vokasi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mensinergikan kebutuhan pendidikan teori dan praktik kejuruan lapangan guna melahirkan talenta siap kerja yang kompetitif di dunia industri.") %>',
                    requireLogin: true
                },
                "ppdb_tk": {
                    title: '<%= Common.getBahasaConfigJS("Portal PPDB (Taman Kanak-Kanak)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Fasilitas pendaftaran daring untuk mengelola penerimaan peserta didik jenjang TK secara digital, terpusat, dan bebas antrean.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Memberikan kemudahan maksimal bagi orang tua untuk mendaftarkan anak mereka dari rumah tanpa perlu menyerahkan formulir fisik.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Alur pendaftaran yang sangat ringkas, validasi usia otomatis, dan sistem pembayaran biaya formulir terintegrasi bank.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Merekam data calon murid, mengunggah dokumen persyaratan dasar, dan mempublikasikan status penerimaan secara transparan.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Orang Tua/Wali Calon Murid dan Panitia PPDB.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mewujudkan proses penerimaan murid tingkat usia dini yang mudah, inklusif, dan sepenuhnya terotomatisasi secara daring.") %>',
                    requireLogin: false
                },
                "ppdb_sd": {
                    title: '<%= Common.getBahasaConfigJS("Portal PPDB (Sekolah Dasar)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Fasilitas registrasi elektronik yang memfasilitasi panitia dan pendaftar dalam proses seleksi penerimaan murid Sekolah Dasar baru.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mengurangi kerumitan administrasi manual saat tahun ajaran baru serta menjamin akurasi data pendaftar sejak tahap awal.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Sistem pemberkasan digital yang aman, pemantauan kuota daya tampung secara real-time, dan notifikasi konfirmasi penerimaan.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyelenggarakan alur pendaftaran, memverifikasi keabsahan dokumen, dan menghasilkan laporan rekapitulasi siswa baru.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Orang Tua/Wali Calon Siswa dan Panitia Pendaftaran.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menjamin terselenggaranya alur pendaftaran murid dasar yang tertib, aman, serta terhindar dari potensi kelalaian input manual.") %>',
                    requireLogin: false
                },
                "ppdb_smp": {
                    title: '<%= Common.getBahasaConfigJS("Portal PPDB (Sekolah Menengah Pertama)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem seleksi penerimaan siswa baru jenjang SMP yang mengakomodasi berbagai jalur masuk sesuai regulasi dinas pendidikan terkini.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Menciptakan proses seleksi yang transparan, adil, dan objektif berdasarkan kriteria nilai atau zonasi wilayah yang terukur.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Kapasitas pemrosesan data bervolume tinggi, pengelompokan jalur prestasi/afirmasi/zonasi, dan fitur peringkat (ranking) dinamis.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menghitung pembobotan nilai pendaftar, memverifikasi dokumen jalur khusus, dan menentukan kelulusan secara presisi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Calon Siswa SMP, Orang Tua/Wali, dan Tim Seleksi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mengakomodasi penyaringan siswa baru secara berkeadilan tinggi melalui kalkulasi parameter zonasi dan prestasi yang transparan.") %>',
                    requireLogin: false
                },
                "ppdb_sma": {
                    title: '<%= Common.getBahasaConfigJS("Portal PPDB (Sekolah Menengah Atas)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Infrastruktur pendaftaran siswa baru jenjang SMA yang dirancang untuk menangani seleksi ketat dan analisis peminatan akademik.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Membantu institusi mendapatkan kandidat siswa terbaik melalui instrumen seleksi komprehensif tanpa campur tangan manual yang berisiko.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Modul tes psikometri/peminatan terintegrasi, pemetaan nilai rapor SMP, dan pengelolaan kuota jalur masuk yang fleksibel.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyelenggarakan ujian saringan masuk, melakukan pemeringkatan otomatis, dan memfasilitasi administrasi daftar ulang.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Calon Siswa SMA, Orang Tua, dan Panitia Penerimaan Tingkat Menengah.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menjamin mutu rekrutmen siswa berkualitas tinggi dengan integrasi sistem pemeringkatan analitis dan pengawasan daya tampung fleksibel.") %>',
                    requireLogin: false
                },
                "ppdb_smk": {
                    title: '<%= Common.getBahasaConfigJS("Portal PPDB (Sekolah Menengah Kejuruan)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Platform penerimaan siswa baru vokasi yang menangani pendaftaran lintas program keahlian dengan kriteria seleksi fisik dan kompetensi.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mengelola kompleksitas pendaftaran berbagai jurusan keahlian secara rapi dan mencegah terjadinya penumpukan berkas fisik di loket.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Formulir spesifik berbasis jurusan, integrasi hasil tes kesehatan/buta warna, dan sinkronisasi otomatis ke data induk siswa vokasi.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Memfasilitasi pemilihan program studi keahlian, mengatur jadwal wawancara, dan mengamankan tahapan penyelesaian pembayaran awal.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Calon Siswa Vokasi, Tim Seleksi Kejuruan, dan Manajemen Sekolah.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mendukung kelancaran seleksi calon siswa jurusan secara sangat presisi, aman, dan tanpa kendala administrasi dokumen yang menumpuk.") %>',
                    requireLogin: false
                },
                "ekantin": {
                    title: '<%= Common.getBahasaConfigJS("Kantin Digital (eKantin)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem manajemen kantin modern yang memfasilitasi ekosistem transaksi tanpa uang tunai (cashless) di lingkungan institusi pendidikan.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mewujudkan lingkungan kantin yang higienis, mempercepat antrean transaksi, serta memberikan kemudahan kontrol pengeluaran bagi orang tua siswa.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Terintegrasi penuh dengan kartu identitas pintar (RFID/NFC), pengisian saldo terpusat, dan riwayat mutasi yang transparan.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Memproses pembayaran digital, mencatat stok inventaris pedagang, dan membatasi limit belanja harian peserta didik sesuai kebijakan orang tua.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Peserta Didik, Pengelola/Pedagang Kantin, dan Orang Tua/Wali.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menciptakan ekosistem kantin higienis, modern, terintegrasi, serta menjamin kenyamanan pengawasan sirkulasi finansial bagi orang tua murid.") %>',
                    requireLogin: false
                },
                "anjungan": {
                    title: '<%= Common.getBahasaConfigJS("Anjungan Layanan Mandiri (Kiosk)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Fasilitas terminal layar sentuh terintegrasi yang ditempatkan di lobi atau area strategis institusi. Memungkinkan peserta didik untuk mengakses dan mencetak dokumen administrasi akademik secara mandiri (self-service) tanpa perlu mengantre di loket Tata Usaha.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mereduksi hingga 70% beban kerja klerikal staf administrasi dan menghilangkan antrean panjang, sekaligus memberikan pengalaman layanan yang instan dan modern bagi mahasiswa/siswa.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Dapat diintegrasikan dengan perangkat keras industrial (Touchscreen, Thermal Printer/Epson L120, Scanner Barcode/RFID) dan beroperasi 24/7 dengan antarmuka yang sangat ramah pengguna.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Pencetakan KRS, KHS, Transkrip Nilai, Surat Keterangan Aktif, pengecekan jadwal, tagihan keuangan, dan informasi pengumuman akademik secara real-time.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Mahasiswa, Siswa, Santri, dan Staf Administrasi/Tata Usaha.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mewujudkan transformasi lobi institusi menjadi pusat layanan digital yang mandiri, responsif, dan bebas antrean melalui integrasi sistem pintar.") %>',
                    requireLogin: true
                },
                "pos": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Kasir Terpadu (Point Of Sale)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Aplikasi perangkat lunak kasir pintar yang didesain khusus untuk mengelola unit usaha institusi seperti koperasi, toko alat tulis, atau fasilitas penatu (laundry).") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meminimalisasi kebocoran finansial (fraud) pada unit usaha dan menghasilkan rekapitulasi laba rugi yang akurat secara instan.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Antarmuka layar sentuh (touchscreen) yang sangat responsif, manajemen stok barang real-time, dan pemindai kode batang (barcode scanner) terpadu.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mencatat transaksi penjualan, mengkalkulasi harga pokok penjualan (HPP), mencetak struk digital, dan menerbitkan laporan arus kas unit usaha.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Petugas Koperasi, Kasir Unit Usaha, dan Bagian Keuangan Institusi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mengamankan tata kelola persediaan barang dan kalkulasi kasir untuk memaksimalkan laju profitabilitas unit bisnis institusi pendidikan.") %>',
                    requireLogin: false
                },
                "kursus": {
                    title: '<%= Common.getBahasaConfigJS("Manajemen Sistem Kursus") %>',
                    desc: '<%= Common.getBahasaConfigJS("Platform khusus untuk merencanakan, mengelola, dan mengevaluasi program pelatihan kompetensi tambahan atau kursus ekstrakurikuler di luar kegiatan akademik utama.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Menyederhanakan proses registrasi peserta pelatihan dan menjamin distribusi materi kursus tersampaikan secara efektif.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Fitur penerbitan sertifikat elektronik (e-certificate) secara otomatis dan pengelompokan jadwal berdasarkan gelombang pelatihan (batch).") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Membuka pendaftaran kelas pelatihan, mengelola presensi instruktur/peserta, dan memonitor kelulusan program sertifikasi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Lembaga Pelatihan/Sertifikasi Internal, Instruktur Praktik, dan Peserta Kursus.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mengoptimalkan administrasi penyelenggaraan pelatihan intensif bersertifikat secara digital penuh guna meningkatkan nilai tambah lulusan.") %>',
                    requireLogin: false
                },
                "les": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Bimbingan Les / Private") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem penjadwalan dan manajemen operasional untuk program bimbingan belajar intensif, tambahan pelajaran, atau layanan les privat bagi peserta didik.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Mengoptimalkan penugasan tenaga pengajar privat dan memastikan setiap sesi pertemuan terekam untuk keperluan penagihan dan evaluasi.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Sistem penagihan presisi berbasis jumlah kehadiran (pay-per-session), penyusunan jadwal personalisasi, dan formulir umpan balik capaian belajar.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mencocokkan ketersediaan tutor dengan murid, merekam agenda bimbingan, dan menghasilkan lembar kemajuan belajar (progress report).") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Tutor/Pengajar Les, Siswa Bimbingan Intensif, dan Koordinator Akademik.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Memberikan layanan manajemen penjadwalan bimbingan belajar yang terstruktur, rapi, dengan fitur kalkulasi penagihan sesi tutor yang sangat presisi.") %>',
                    requireLogin: false
                },
                "karir": {
                    title: '<%= Common.getBahasaConfigJS("Lowongan Pekerjaan / Karir") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul Lowongan Pekerjaan / Karir disiapkan sebagai portal resmi institusi untuk mempublikasikan kebutuhan pegawai, dosen, guru, tenaga kependidikan, staf administrasi, maupun posisi profesional lain yang dibutuhkan secara terbuka, rapi, dan mudah diakses oleh calon pelamar.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Membantu institusi menampilkan citra rekrutmen yang profesional, mempercepat distribusi informasi lowongan, mengurangi proses pendaftaran manual, serta memudahkan calon pelamar memahami posisi, persyaratan, jadwal seleksi, dan tahapan administrasi yang harus dilengkapi.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Mendukung publikasi informasi karir secara mandiri, pendaftaran pelamar online, pengelolaan berkas digital, validasi administrasi, status seleksi, dan integrasi bertahap dengan modul SDM/Kepegawaian setelah kandidat dinyatakan diterima.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyediakan halaman informasi lowongan, formulir pendaftaran calon pegawai, unggah dokumen pendukung, pengelompokan posisi, monitoring proses seleksi, serta komunikasi awal antara institusi dan calon pelamar melalui alur digital yang terdokumentasi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Calon Pegawai, Calon Dosen/Guru, Tenaga Kependidikan, HRD/Kepegawaian, Pimpinan Unit, serta Tim Seleksi Penerimaan Pegawai Baru.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Portal Karir memperkuat tata kelola rekrutmen institusi agar lebih transparan, cepat, terdokumentasi, dan memberikan pengalaman profesional sejak tahap pertama calon pegawai mengenal institusi.") %>',
                    requireLogin: false
                },
                "antar_jemput": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Antar Jemput Terintegrasi") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul Antar Jemput dirancang untuk mengelola layanan kendaraan operasional, penjemput pribadi, gerbang keamanan, monitor antrian, dan pengumuman otomatis ke kelas dalam satu alur digital yang aman dan terdokumentasi.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Membantu sekolah, kampus, pesantren, dan yayasan memastikan proses penjemputan siswa, guru, mahasiswa, dosen, maupun pegawai berjalan tertib mulai dari jadwal, manifest peserta, validasi kartu penjemput, pemanggilan kelas, hingga bukti serah terima.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Mendukung master data kendaraan, sopir, kenek, rute, kartu penjemput, jadwal antar jemput, daftar peserta, transaksi harian, detail panggilan, nomor antrian, log notifikasi, serta integrasi bertahap dengan asset, kepegawaian, akademik, dan perangkat soundbox/monitor kelas.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Satpam atau petugas dapat melakukan tap kartu maupun scan barcode di gerbang. Sistem memvalidasi kartu aktif, mencari peserta sesuai jadwal, membuat transaksi penjemputan, menampilkan antrian pada monitor gerbang, mengirim pesan ke soundbox kelas, mencatat status keluar kelas, dan menyelesaikan transaksi setelah serah terima dikonfirmasi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Admin Operasional, Satpam/Petugas Gerbang, Sopir, Kenek, Guru/Wali Kelas, Bagian Kesiswaan/Kemahasiswaan, Orang Tua/Wali, Siswa, Mahasiswa, Guru, Dosen, dan Pegawai.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Sistem Antar Jemput memperkuat kontrol keselamatan, mempercepat panggilan peserta, mengurangi antrean gerbang, serta menyediakan audit trail lengkap mulai dari kedatangan penjemput, notifikasi kelas, sampai proses serah terima selesai.") %>',
                    requireLogin: false
                },
                "pengunjung_pustaka": {
                    title: '<%= Common.getBahasaConfigJS("Pengunjung Pustaka") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem untuk mendaftarkan diri secara mandiri (self-service) bagi peserta didik atau tamu yang ingin berkunjung ke perpustakaan institusi.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Memudahkan pendataan statistik pengunjung perpustakaan secara otomatis tanpa perlu antrean pencatatan manual.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Antarmuka yang sangat responsif, mendukung pemindaian kartu anggota, dan pelaporan statistik kunjungan waktu nyata.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mencatat daftar hadir, tujuan kunjungan, dan merekam data diri pengunjung perpustakaan dengan cepat.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Pengunjung Perpustakaan, Pustakawan, dan Mahasiswa/Siswa.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Solusi modern untuk mencatat dan melacak kunjungan ke fasilitas perpustakaan dalam rangka evaluasi layanan secara digital.") %>',
                    requireLogin: false
                },
                "buku_tamu": {
                    title: '<%= Common.getBahasaConfigJS("Buku Tamu Institusi") %>',
                    desc: '<%= Common.getBahasaConfigJS("Sistem pendataan buku tamu institusi yang telah sepenuhnya terdigitalisasi sebagai pengganti buku registrasi tamu konvensional.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Merapikan arsip kunjungan dan memfasilitasi pelacakan riwayat tamu demi mendukung protokol keamanan institusi.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Riwayat kunjungan tersimpan aman secara terpusat, dapat dicari (searchable) dengan mudah, serta meminimalisasi kehilangan data historis.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Mendata informasi personal tamu, tujuan kunjungan, pihak yang ingin ditemui, beserta waktu kedatangan/kepulangan.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Tamu Institusi, Resepsionis, dan Petugas Keamanan (Satpam).") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Memastikan setiap kunjungan tamu tercatat rapi secara elektronik guna meningkatkan kredibilitas, kerapian arsip, dan keamanan lingkungan.") %>',
                    requireLogin: false
                },
                "absen_siswa": {
                    title: '<%= Common.getBahasaConfigJS("Sistem Absen Siswa Mandiri") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul untuk mempermudah siswa melakukan absensi secara mandiri melalui anjungan absen terintegrasi.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meningkatkan kedisiplinan dan efisiensi pencatatan kehadiran harian peserta didik.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Antarmuka cepat, terintegrasi langsung dengan sistem akademik utama dan rekapitulasi otomatis.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Merekam data kehadiran siswa secara seketika saat siswa berinteraksi dengan anjungan absensi.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Siswa, Guru Piket, dan Staf Tata Usaha.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Menciptakan budaya disiplin melalui pencatatan absensi yang cepat, mandiri, dan transparan.") %>',
                    requireLogin: false
                },
                "portal_rekanan": {
                    title: '<%= Common.getBahasaConfigJS("Portal Rekanan (e-Procurement)") %>',
                    desc: '<%= Common.getBahasaConfigJS("Modul khusus yang dirancang untuk memfasilitasi rekanan, vendor, atau penyedia barang dan jasa dalam melakukan pendaftaran secara mandiri serta melengkapi kelengkapan berkas administratif. Ke depannya, modul ini akan berevolusi menjadi sistem e-Procurement yang utuh.") %>',
                    manfaat: '<%= Common.getBahasaConfigJS("Meningkatkan transparansi pengadaan barang dan jasa serta memberikan kemudahan akses bagi pihak ketiga untuk menjalin kerja sama dengan institusi.") %>',
                    keunggulan: '<%= Common.getBahasaConfigJS("Portal mandiri (self-service) yang efisien, mengurangi proses tatap muka untuk pendaftaran awal, dan penyimpanan berkas digital yang aman.") %>',
                    fungsi: '<%= Common.getBahasaConfigJS("Menyediakan formulir pendaftaran vendor, fasilitas unggah dokumen legalitas perusahaan, serta pusat informasi pengadaan barang dan jasa.") %>',
                    sasaran: '<%= Common.getBahasaConfigJS("Vendor, Pemasok (Supplier), Rekanan Bisnis, dan Bagian Pengadaan Logistik Institusi.") %>',
                    kesimpulan: '<%= Common.getBahasaConfigJS("Mewujudkan ekosistem pengadaan institusi yang profesional, tertib administrasi, dan siap menyongsong digitalisasi e-Procurement masa depan.") %>',
                    requireLogin: false
                }
            };

            // ========================================================================================
            // TEMPLATE MODAL INFORMASI DINAMIS
            // Membuat elemen HTML Modal secara dinamis dan menyisipkannya ke dalam DOM Body
            // ========================================================================================
            const modalHtmlTemplate = `
            <div class="modal fade" id="dynamicInfoModal" tabindex="-1" aria-labelledby="dynamicInfoModalLabel" aria-hidden="true">
              <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 20px; overflow: hidden;">
                  
                  <div class="modal-header bg-primary text-white border-0 p-4">
                    <h4 class="modal-title fw-bold" id="dynamicInfoModalLabel">
                        <i class="fas fa-info-circle me-2"></i><span id="modalTitle"></span>
                    </h4>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  
                  <div class="modal-body p-5 text-start">
                    
                    <div class="mb-4">
                        <h6 class="fw-bold text-primary text-uppercase" style="letter-spacing: 1px;">
                            <%= Common.getBahasaConfig("Deskripsi Modul") %>
                        </h6>
                        <p class="text-secondary" style="line-height: 1.7;" id="modalDesc"></p>
                    </div>
                    
                    <div class="row g-4 mb-4">
                        <div class="col-md-6">
                            <h6 class="fw-bold text-primary text-uppercase" style="letter-spacing: 1px;">
                                <i class="fas fa-star me-2 text-warning"></i><%= Common.getBahasaConfig("Manfaat") %>
                            </h6>
                            <p class="text-secondary text-sm" style="line-height: 1.6;" id="modalManfaat"></p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="fw-bold text-primary text-uppercase" style="letter-spacing: 1px;">
                                <i class="fas fa-check-circle me-2 text-success"></i><%= Common.getBahasaConfig("Keunggulan") %>
                            </h6>
                            <p class="text-secondary text-sm" style="line-height: 1.6;" id="modalKeunggulan"></p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="fw-bold text-primary text-uppercase" style="letter-spacing: 1px;">
                                <i class="fas fa-cogs me-2 text-secondary"></i><%= Common.getBahasaConfig("Fungsi Utama") %>
                            </h6>
                            <p class="text-secondary text-sm" style="line-height: 1.6;" id="modalFungsi"></p>
                        </div>
                        <div class="col-md-6">
                            <h6 class="fw-bold text-primary text-uppercase" style="letter-spacing: 1px;">
                                <i class="fas fa-users me-2 text-info"></i><%= Common.getBahasaConfig("Penerima Manfaat") %>
                            </h6>
                            <p class="text-secondary text-sm" style="line-height: 1.6;" id="modalSasaran"></p>
                        </div>
                    </div>

                    <hr class="my-4" style="opacity: 0.1;">
                    
                    <div class="mb-2">
                        <h6 class="fw-bold text-primary text-uppercase" style="letter-spacing: 1px;">
                            <i class="fas fa-lightbulb me-2 text-warning"></i><%= Common.getBahasaConfig("Kesimpulan") %>
                        </h6>
                        <p class="text-secondary fw-semibold" style="line-height: 1.7; font-style: italic;" id="modalKesimpulan"></p>
                    </div>

                    <div id="loginCredentialsAlert" class="alert alert-warning border-0 shadow-sm d-none align-items-center p-4 mt-4" role="alert" style="border-radius: 12px; background: linear-gradient(to right, #fffbeb, #fef3c7);">
                        <i class="fas fa-exclamation-triangle fa-2x me-4 text-warning"></i>
                        <div>
                            <strong class="d-block text-dark mb-1 fs-5">
                                <%= Common.getBahasaConfig("Informasi Akses Demonstrasi") %>
                            </strong>
                            <span class="text-secondary mb-2 d-block">
                                <%= Common.getBahasaConfig("Jika Anda ingin memasuki simulasi antarmuka sistem, silakan gunakan kredensial berikut:") %>
                            </span>
                            <span class="badge bg-white text-dark border border-warning shadow-sm mt-1 fs-6 py-2 px-3">
                                <%= Common.getBahasaConfig("Nama Pengguna:") %> <span class="text-primary font-monospace fw-bold ms-1">demo</span>
                            </span>
                            <span class="badge bg-white text-dark border border-warning shadow-sm mt-1 fs-6 py-2 px-3 ms-2">
                                <%= Common.getBahasaConfig("Kata Sandi:") %> <span class="text-primary font-monospace fw-bold ms-1">demo123</span>
                            </span>
                        </div>
                    </div>

                  </div>
                  
                  <div class="modal-footer bg-light justify-content-between border-0 p-4">
                    <button 
                        type="button" 
                        class="btn btn-outline-secondary px-4 py-2 fw-bold" 
                        style="border-radius: 10px;" 
                        data-bs-dismiss="modal"
                    >
                        <%= Common.getBahasaConfig("Kembali") %>
                    </button>
                    <a 
                        href="#" 
                        id="modalDemoLink" 
                        class="btn btn-primary px-5 py-2 fw-bold text-uppercase shadow-sm" 
                        style="border-radius: 10px; letter-spacing: 1px;"
                    >
                        <%= Common.getBahasaConfig("Lanjutkan Demo") %> <i class="fas fa-arrow-right ms-2"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            `;

            // Menyisipkan Modal ke Body HTML
            document.body.insertAdjacentHTML('beforeend', modalHtmlTemplate);
            
            // Inisialisasi Modal dengan JavaScript Bootstrap
            const dynamicModal = new bootstrap.Modal(document.getElementById('dynamicInfoModal'));

            // Memasang event listener ke seluruh tombol pemicu modul (Trigger Modal)
            const alertButtons = document.querySelectorAll('.trigger-modal');
            alertButtons.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault(); 
                    
                    const moduleId = this.getAttribute('data-module-id');
                    const targetUrl = this.getAttribute('href');
                    const data = moduleDict[moduleId];

                    // Jika Modul ID terdaftar dalam Dictionary, set data ke dalam DOM Modal
                    if(data) {
                        document.getElementById('modalTitle').textContent = data.title;
                        document.getElementById('modalDesc').textContent = data.desc;
                        document.getElementById('modalManfaat').textContent = data.manfaat;
                        document.getElementById('modalKeunggulan').textContent = data.keunggulan;
                        document.getElementById('modalFungsi').textContent = data.fungsi;
                        document.getElementById('modalSasaran').textContent = data.sasaran;
                        document.getElementById('modalKesimpulan').textContent = data.kesimpulan;

                        // Tampilkan atau Sembunyikan Alert Login tergantung properti requireLogin
                        const loginAlert = document.getElementById('loginCredentialsAlert');
                        if(data.requireLogin === true) {
                            loginAlert.classList.remove('d-none');
                            loginAlert.classList.add('d-flex');
                        } else {
                            loginAlert.classList.remove('d-flex');
                            loginAlert.classList.add('d-none');
                        }

                        // Mengelola Link URL Demo (Jika #, maka sistem belum siap. Jika URL nyata, buka di tab baru)
                        const demoLink = document.getElementById('modalDemoLink');
                        if (targetUrl === "#") {
                            demoLink.setAttribute('href', '#');
                            demoLink.removeAttribute('target');
                            demoLink.setAttribute('onclick', `tampilkanPesanGagalFormal('akses demo fasilitas ini', '<%= Common.getBahasaConfigJS("Fasilitas operasional ini masih dalam tahap penyempurnaan pengembangan sehingga belum dapat diakses.") %>', ['Silakan coba kembali pada kesempatan berikutnya setelah pengembangan fasilitas ini rampung.']); return false;`);
                        } else {
                            demoLink.setAttribute('href', targetUrl);
                            demoLink.setAttribute('target', '_blank');
                            demoLink.removeAttribute('onclick');
                        }

                        // Menampilkan Modal Popup Info Modul
                        dynamicModal.show();
                    } else {
                        // Jika Modul ID tidak terdaftar, tampilkan peringatan Default
                        tampilkanPesanGagalFormal("penampilan informasi rincian layanan", '<%= Common.getBahasaConfigJS("Informasi rincian untuk layanan ini tidak ditemukan di dalam sistem.") %>', ["Coba pilih layanan/modul lain, atau muat ulang halaman ini.", "Bila layanan ini seharusnya tersedia, segera laporkan kepada Administrator Sistem."]);
                    }
                });
            });
        });

        // ============================================================================================
        // FUNGSI ZOOM GAMBAR HARDWARE (ANJUNGAN & POS)
        // Fungsi ini akan dipanggil saat pengguna mengklik gambar Anjungan Kiosk atau POS
        // ============================================================================================
        window.showImageModal = function(imageSrc) {
            document.getElementById('modalExpandedImage').src = imageSrc;
            var imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
            imageModal.show();
        };

        // ============================================================================================
        // SMART NAVIGATION: highlight menu aktif + auto-close mobile menu saat link diklik
        // ============================================================================================
        (function() {
            var navLinks = document.querySelectorAll('.custom-nav-link[href^="#"], #mobileNav .nav-link[href^="#"]');
            if (!navLinks || navLinks.length === 0) {
                return;
            }

            for (var i = 0; i < navLinks.length; i++) {
                navLinks[i].addEventListener('click', function() {
                    var mobileNav = document.getElementById('mobileNav');
                    if (mobileNav && mobileNav.classList.contains('show') && window.bootstrap && bootstrap.Collapse) {
                        var bsCollapse = bootstrap.Collapse.getInstance(mobileNav) || new bootstrap.Collapse(mobileNav, { toggle: false });
                        bsCollapse.hide();
                    }
                });
            }

            if ('IntersectionObserver' in window) {
                var sections = [];
                for (var j = 0; j < navLinks.length; j++) {
                    var href = navLinks[j].getAttribute('href');
                    if (href && href.length > 1) {
                        var section = document.querySelector(href);
                        if (section && sections.indexOf(section) === -1) {
                            sections.push(section);
                        }
                    }
                }
                var observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            var id = '#' + entry.target.getAttribute('id');
                            for (var k = 0; k < navLinks.length; k++) {
                                if (navLinks[k].classList) {
                                    if (navLinks[k].getAttribute('href') === id) {
                                        navLinks[k].classList.add('active');
                                    } else {
                                        navLinks[k].classList.remove('active');
                                    }
                                }
                            }
                        }
                    });
                }, { rootMargin: '-35% 0px -55% 0px', threshold: 0.01 });

                for (var s = 0; s < sections.length; s++) {
                    observer.observe(sections[s]);
                }
            }
        })();

    </script>
    <jsp:include page="/WEB-INF/baru/include/bantuan_button.jsp" />
</body>
</html>