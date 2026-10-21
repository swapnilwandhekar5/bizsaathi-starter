import AuthGate from './AuthGate.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { supabase } from './lib/supabase.js';
const seed = {
  business: { name: 'My Business', owner: 'Business Owner', gstin: '', currency: 'INR' },
  products: [
    { id: 1, name: 'Demo Product A', sku: 'SKU-001', price: 250, cost: 150, stock: 20, tax: 18 },
    { id: 2, name: 'Demo Product B', sku: 'SKU-002', price: 120, cost: 70, stock: 35, tax: 5 },
  ],
  customers: [{ id: 1, name: 'Walk-in Customer', phone: '' }],
  sales: [], purchases: [], expenses: []
};
const readState = () => { try { return JSON.parse(localStorage.getItem('vyaparone-demo')) || seed; } catch { return seed; } };
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n || 0));
const uid = () => Date.now() + Math.floor(Math.random() * 1000);

function App() {
  const [data, setData] = useState(readState);
  const [page, setPage] = useState('Overview');
  const [toast, setToast] = useState('');
  const [productForm, setProductForm] = useState({ name: '', sku: '', price: '', cost: '', stock: '', tax: '0' });
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '' });
  const [saleForm, setSaleForm] = useState({ productId: '', customerId: '1', qty: '1' });
  const [purchaseForm, setPurchaseForm] = useState({ productId: '', qty: '1', unitCost: '' });
  const [businessForm, setBusinessForm] = useState(data.business);
  const [search, setSearch] = useState('');

  const [businessId, setBusinessId] = useState(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [platformOverview, setPlatformOverview] = useState(null);
  const [platformOverviewLoading, setPlatformOverviewLoading] = useState(false);
  const [platformOverviewError, setPlatformOverviewError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [platformUsersLoading, setPlatformUsersLoading] = useState(false);
  const [platformUsersError, setPlatformUsersError] = useState('');

  useEffect(() => {
    if (!isPlatformAdmin || page !== 'Super Admin') return;

    let cancelled = false;

    async function loadPlatformOverview() {
      setPlatformOverviewLoading(true);
      setPlatformOverviewError('');

      try {
        const { data, error } = await supabase.rpc('get_platform_overview');
        if (error) throw error;
        if (!cancelled) setPlatformOverview(data);
      } catch (error) {
        console.error('Platform overview load failed:', error);
        if (!cancelled) setPlatformOverviewError(error.message || 'Dashboard data load nahi hua.');
      } finally {
        if (!cancelled) setPlatformOverviewLoading(false);
      }
    }

    loadPlatformOverview();

    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin, page]);

  useEffect(() => {
    let cancelled = false;

    async function checkPlatformAdmin() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!user) return;

        console.log('BizSaathi auth user ID:', user.id);

       const { data, error } = await supabase.rpc('is_platform_admin');


if (error) throw error;

if (!cancelled) setIsPlatformAdmin(data === true);
      } catch (error) {
        console.error('Platform admin check failed:', error);
        if (!cancelled) setIsPlatformAdmin(false);
      } finally {
        if (!cancelled) setAdminLoading(false);
      }
    }

    checkPlatformAdmin();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBusiness() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!user) return;

        console.log('BizSaathi auth user ID:', user.id);

        let { data: membership, error: membershipError } = await supabase
          .from('business_members')
          .select('business_id, businesses(id, name, owner_id)')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) throw membershipError;

        if (!membership) {
          const businessName = user.user_metadata?.business_name?.trim();
          if (businessName) {
            const { data: newBusinessId, error: createError } = await supabase.rpc(
              'create_business_for_current_user',
              { p_name: businessName }
            );
            if (createError) throw createError;

            const { data: createdMembership, error: reloadError } = await supabase
              .from('business_members')
              .select('business_id, businesses(id, name, owner_id)')
              .eq('user_id', user.id)
              .eq('business_id', newBusinessId)
              .maybeSingle();
            if (reloadError) throw reloadError;
            membership = createdMembership;
          }
        }

        console.log('BizSaathi membership result:', membership);

        if (membership?.business_id) {
          const { data: isActive, error: statusError } = await supabase.rpc(
            'is_business_active',
            { p_business_id: membership.business_id }
          );

          if (statusError) throw statusError;

          if (!isActive) {
            if (!cancelled) {
              notify('Your business account is suspended or unavailable. Please contact the platform administrator.');
            }
            return;
          }
        }

        if (!cancelled && membership?.businesses) {
          const business = membership.businesses;
          setBusinessId(business.id);
          console.log('BizSaathi loaded business ID:', business.id);

          setData(previous => ({
            ...previous,
            business: {
              ...previous.business,
              name: business.name
            }
          }));

          setBusinessForm(previous => ({
            ...previous,
            name: business.name
          }));
        }
      } catch (error) {
        console.error('Business load error:', error);
        if (!cancelled) notify('Business load nahi hua: ' + error.message);
      } finally {
        if (!cancelled) setBusinessLoading(false);
      }
    }

    loadBusiness();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    async function loadCustomers() {
      try {
        const { data: rows, error } = await supabase
          .from('customers')
          .select('id, business_id, name, phone, created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!cancelled) {
          setData(previous => ({
            ...previous,
            customers: (rows || []).map(row => ({
              id: row.id,
              name: row.name,
              phone: row.phone || ''
            }))
          }));
        }
      } catch (error) {
        console.error('Customer load error:', error);
        if (!cancelled) notify('Customer list load nahi hui: ' + error.message);
      }
    }

    loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [businessId]);
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    async function loadProducts() {
      try {
        const { data: rows, error } = await supabase
          .from('products')
          .select('id, business_id, name, sku, quantity, sale_price, cost_price')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!cancelled) {
          setData(previous => ({
            ...previous,
            products: (rows || []).map(row => ({
              id: row.id,
              name: row.name,
              sku: row.sku || '',
              price: Number(row.sale_price || 0),
              cost: Number(row.cost_price || 0),
              stock: Number(row.quantity || 0),
              tax: 0
            }))
          }));
        }
      } catch (error) {
        console.error('Product load error:', error);
        if (!cancelled) notify('Products load nahi hue: ' + error.message);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [businessId]);
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    async function loadTransactions() {
      try {
        const [salesResult, purchasesResult, expensesResult] = await Promise.all([
          supabase.from('sales')
            .select('id, business_id, invoice_number, customer_name, total, created_at')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false }),
          supabase.from('purchases')
            .select('id, business_id, product_id, product_name, quantity, unit_cost, total, created_at')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false }),
          supabase.from('expenses')
            .select('id, business_id, title, amount, created_at')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
        ]);

        if (salesResult.error) throw salesResult.error;
        if (purchasesResult.error) throw purchasesResult.error;
        if (expensesResult.error) throw expensesResult.error;
        if (cancelled) return;

        setData(previous => ({
          ...previous,
          sales: (salesResult.data || []).map(row => ({
            id: row.id,
            invoice: row.invoice_number || '',
            date: row.created_at,
            customerName: row.customer_name || '',
            productName: '',
            qty: 0,
            unitPrice: 0,
            unitCost: 0,
            subtotal: Number(row.total || 0),
            taxAmount: 0,
            total: Number(row.total || 0)
          })),
          purchases: (purchasesResult.data || []).map(row => ({
            id: row.id,
            date: row.created_at,
            productName: row.product_name || '',
            qty: Number(row.quantity || 0),
            unitCost: Number(row.unit_cost || 0),
            total: Number(row.total || 0)
          })),
          expenses: (expensesResult.data || []).map(row => ({
            id: row.id,
            title: row.title || '',
            amount: Number(row.amount || 0),
            date: row.created_at
          }))
        }));
        console.log('BizSaathi transactions loaded from Supabase');
      } catch (error) {
        console.error('Transaction load error:', error);
        if (!cancelled) notify('Transactions load nahi hue: ' + error.message);
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [businessId]);
  function update(next) { setData(next); localStorage.setItem('vyaparone-demo', JSON.stringify(next)); }
  function notify(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }
  const totalSales = data.sales.reduce((s, x) => s + x.total, 0);
  const localDateKey = value => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayKey = localDateKey(new Date());
  const monthKey = todayKey.slice(0, 7);
  const dailySales = data.sales.filter(s => s.date && localDateKey(s.date) === todayKey);
  const monthlySales = data.sales.filter(s => s.date && localDateKey(s.date).slice(0, 7) === monthKey);
  const dailySalesTotal = dailySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const monthlySalesTotal = monthlySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const dailyExpenses = data.expenses.filter(e => e.date && new Date(e.date).toLocaleDateString('en-CA') === todayKey);
  const monthlyExpenses = data.expenses.filter(e => e.date && new Date(e.date).toLocaleDateString('en-CA').slice(0, 7) === monthKey);
  const dailyExpensesTotal = dailyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const monthlyExpensesTotal = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalPurchases = data.purchases.reduce((s, x) => s + x.total, 0);
  const totalExpenses = data.expenses.reduce((s, x) => s + x.amount, 0);
  const stockValue = data.products.reduce((s, p) => s + p.stock * p.cost, 0);
  const grossProfit = data.sales.reduce((s, sale) => s + sale.qty * (sale.unitPrice - sale.unitCost), 0);
  const filteredProducts = data.products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()));
  const selectedProduct = data.products.find(p => String(p.id) === String(saleForm.productId));
  const salePreview = selectedProduct ? Number(saleForm.qty || 0) * selectedProduct.price * (1 + selectedProduct.tax / 100) : 0;

  async function addProduct(e) {
    e.preventDefault();
    if (!productForm.name.trim()) return notify('Product name is required');
    if (!businessId) return notify('Business abhi load nahi hua. Dobara try karo.');

    try {
      const { data: row, error } = await supabase
        .from('products')
        .insert({
          business_id: businessId,
          name: productForm.name.trim(),
          sku: productForm.sku.trim() || null,
          quantity: Number(productForm.stock) || 0,
          sale_price: Number(productForm.price) || 0,
          cost_price: Number(productForm.cost) || 0
        })
        .select('id, business_id, name, sku, quantity, sale_price, cost_price')
        .single();

      if (error) throw error;

      const product = {
        id: row.id,
        name: row.name,
        sku: row.sku || '',
        price: Number(row.sale_price || 0),
        cost: Number(productForm.cost) || 0,
        stock: Number(row.quantity || 0),
        tax: Number(productForm.tax) || 0
      };

      update({ ...data, products: [product, ...data.products] });
      setProductForm({ name: '', sku: '', price: '', cost: '', stock: '', tax: '0' });
      notify('Product saved to Supabase');
    } catch (error) {
      console.error('Product save error:', error);
      notify('Product save nahi hua: ' + error.message);
    }
  }
  async function addCustomer(e) {
    e.preventDefault();

    if (!customerForm.name.trim()) {
      return notify('Customer name is required');
    }

    if (!businessId) {
      return notify('Business abhi load nahi hua. Dobara try karo.');
    }

    try {
      const { data: row, error } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim() || null
        })
        .select('id, business_id, name, phone, created_at')
        .single();

      if (error) throw error;

      setData(previous => ({
        ...previous,
        customers: [
          ...previous.customers,
          { id: row.id, name: row.name, phone: row.phone || '' }
        ]
      }));

      setCustomerForm({ name: '', phone: '' });
      notify('Customer saved to cloud');
    } catch (error) {
      console.error('Customer save error:', error);
      notify('Customer save nahi hua: ' + error.message);
    }
  }

  async function makeSale(e) {
    e.preventDefault();

    if (!businessId) {
      return notify('Pehle business select karo');
    }

    const p = data.products.find(
      x => String(x.id) === String(saleForm.productId)
    );
    const qty = Number(saleForm.qty);

    if (!p || !Number.isFinite(qty) || qty <= 0) {
      return notify('Choose a product and valid quantity');
    }

    if (Number(p.stock) < qty) {
      return notify('Not enough stock available');
    }

    const customer = data.customers.find(
      x => String(x.id) === String(saleForm.customerId)
    );
    const customerName = customer?.name || 'Walk-in Customer';

    try {
      const { data: saleId, error: saleError } = await supabase.rpc(
        'create_business_sale',
        {
          p_business_id: businessId,
          p_product_id: p.id,
          p_quantity: qty,
          p_customer_name: customerName
        }
      );

      if (saleError) throw saleError;
      if (!saleId) throw new Error('Supabase ne sale ID return nahi ki');

      const { data: savedSale, error: fetchError } = await supabase
        .from('sales')
        .select('id, invoice_number, created_at, total')
        .eq('id', saleId)
        .eq('business_id', businessId)
        .single();

      if (fetchError) throw fetchError;

      const sale = {
        id: savedSale.id,
        invoice: savedSale.invoice_number,
        date: savedSale.created_at,
        productId: p.id,
        productName: p.name,
        customerName,
        qty,
        unitPrice: Number(p.price),
        unitCost: Number(p.cost || 0),
        subtotal: Number(savedSale.total),
        taxAmount: 0,
        total: Number(savedSale.total)
      };

      update({
        ...data,
        products: data.products.map(x =>
          String(x.id) === String(p.id)
            ? { ...x, stock: Number(x.stock) - qty }
            : x
        ),
        sales: [sale, ...data.sales]
      });

      setSaleForm({ ...saleForm, qty: '1' });
      notify('Cloud invoice ' + sale.invoice + ' created');
    } catch (error) {
      console.error('Cloud sale error:', error);
      notify('Sale save nahi hui: ' + (error.message || 'Unknown error'));
    }
  }
  async function makePurchase(e) {
    e.preventDefault();

    const p = data.products.find(
      x => String(x.id) === String(purchaseForm.productId)
    );
    const qty = Number(purchaseForm.qty);
    const unitCost = Number(purchaseForm.unitCost);

    if (!businessId) return notify('Business abhi load nahi hua. Dobara try karo.');
    if (!p || !Number.isFinite(qty) || qty <= 0 ||
        !Number.isFinite(unitCost) || unitCost < 0) {
      return notify('Enter valid purchase details');
    }

    try {
      const { data: purchaseId, error } = await supabase.rpc(
        'record_business_purchase',
        {
          p_business_id: businessId,
          p_product_id: p.id,
          p_quantity: qty,
          p_unit_cost: unitCost
        }
      );

      if (error) throw error;

      const purchase = {
        id: purchaseId,
        date: new Date().toISOString(),
        productName: p.name,
        qty,
        unitCost,
        total: qty * unitCost
      };

      setData(previous => ({
        ...previous,
        products: previous.products.map(x =>
          String(x.id) === String(p.id)
            ? { ...x, stock: x.stock + qty, cost: unitCost }
            : x
        ),
        purchases: [purchase, ...previous.purchases]
      }));

      localStorage.setItem('vyaparone-demo', JSON.stringify({
        ...data,
        products: data.products.map(x =>
          String(x.id) === String(p.id)
            ? { ...x, stock: x.stock + qty, cost: unitCost }
            : x
        ),
        purchases: [purchase, ...data.purchases]
      }));

      setPurchaseForm({ productId: '', qty: '', unitCost: '' });
      notify('Purchase Supabase mein save ho gayi');
    } catch (error) {
      console.error('Cloud purchase error:', error);
      notify('Purchase save nahi hui: ' + (error.message || 'Unknown error'));
    }
  }
  async function addExpense(e) {
    e.preventDefault();

    const title = expenseForm.title.trim();
    const amount = Number(expenseForm.amount);

    if (!businessId) return notify('Business abhi load nahi hua. Dobara try karo.');
    if (!title || !Number.isFinite(amount) || amount <= 0) {
      return notify('Expense name aur valid amount enter karo');
    }

    try {
      const { data: expenseId, error } = await supabase.rpc(
        'record_business_expense',
        {
          p_business_id: businessId,
          p_title: title,
          p_amount: amount
        }
      );

      if (error) throw error;

      const expense = {
        id: expenseId,
        title,
        amount,
        date: new Date().toISOString()
      };

      update({
        ...data,
        expenses: [expense, ...data.expenses]
      });

      setExpenseForm({ title: '', amount: '' });
      notify('Expense Supabase mein save ho gaya');
    } catch (error) {
      console.error('Cloud expense error:', error);
      notify('Expense save nahi hua: ' + (error.message || 'Unknown error'));
    }
  }
  function saveBusiness(e) { e.preventDefault(); update({ ...data, business: businessForm }); notify('Business profile saved'); }
  function resetDemo() { if (confirm('Reset all local demo data? This cannot be undone.')) { localStorage.removeItem('vyaparone-demo'); setData(seed); setBusinessForm(seed.business); notify('Demo data reset'); } }
  function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bizsaathi-demo-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
  useEffect(() => {
    if (!isPlatformAdmin || page !== 'User Management') return;
    let cancelled = false;
    async function loadPlatformUsers() {
      setPlatformUsersLoading(true);
      setPlatformUsersError('');
      try {
        const { data, error } = await supabase.rpc('get_platform_users');
        if (error) throw error;
        if (!cancelled) setPlatformUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Platform users load failed:', error);
        if (!cancelled) setPlatformUsersError(error.message || 'Users load nahi hue.');
      } finally {
        if (!cancelled) setPlatformUsersLoading(false);
      }
    }
    loadPlatformUsers();
    return () => { cancelled = true; };
  }, [isPlatformAdmin, page]);
  const nav = [{ group: 'WORKSPACE', items: ['Overview', 'Billing', 'Products & Stock', 'Purchases', 'Customers', 'Expenses', 'Reports'] }, { group: 'SETTINGS', items: ['Business Settings', 'Subscription'] }, ...(isPlatformAdmin ? [{ group: 'PLATFORM', items: ['Super Admin', 'User Management'] }] : [])];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">B</div><div><b>BizSaathi</b><small>BUSINESS OS</small></div></div>
      <div className="workspace"><div className="avatar">{(data.business.name || 'B').slice(0,1).toUpperCase()}</div><div className="workspace-copy"><b>{data.business.name || 'My Business'}</b><small>Demo workspace</small></div><span>*</span></div>
      {nav.map(section => <div className="nav-section" key={section.group}><div className="nav-label">{section.group}</div>{section.items.map(item => <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => setPage(item)}><span className="nav-icon">{({'Overview':'O','Billing':'B','Products & Stock':'P','Purchases':'I','Customers':'C','Expenses':'Rs.','Reports':'R','Business Settings':'S','Subscription':'*','Super Admin':'A','User Management':'U'})[item]}</span>{item}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-top"><span className="plan-dot"></span> DEMO PLAN</div><p>Your local demo workspace is ready.</p><button onClick={() => setPage('Subscription')}>View plans <span>-&gt;</span></button></div><small className="version">BizSaathi Starter | v0.1</small></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><span className="demo-badge"><i></i> Demo mode</span><button className="icon-button" title="Export local data" onClick={exportData}>I</button><div className="profile-chip"><div className="profile-avatar">{(data.business.owner || 'O').slice(0,1).toUpperCase()}</div><div><b>{data.business.owner || 'Owner'}</b><small>Owner account</small></div></div></div></header>
      <div className="content">
        {page === 'Super Admin' && isPlatformAdmin && <>
          <PageHeading title="Super Admin Dashboard" desc="Platform overview of registered businesses and user accounts." />
          {platformOverviewLoading && <div className="panel">Loading platform overview...</div>}
          {platformOverviewError && <div className="notice wide-notice">Dashboard error: {platformOverviewError}</div>}
          {!platformOverviewLoading && !platformOverviewError && platformOverview && <>
            <div className="stat-grid">
              <Stat title="Registered businesses" value={platformOverview.total_businesses ?? (platformOverview.businesses || []).length} note="Businesses created on the platform" icon="B" tone="blue" />
              <Stat title="Active businesses" value={(platformOverview.businesses || []).filter(b => b.status !== 'suspended').length} note="Currently active businesses" icon="A" tone="green" />
              <Stat title="Suspended businesses" value={(platformOverview.businesses || []).filter(b => b.status === 'suspended').length} note="Businesses currently suspended" icon="S" tone="orange" />
              <Stat title="Total recorded sales" value={money((platformOverview.businesses || []).reduce((sum, b) => sum + Number(b.total_sales || 0), 0))} note="Combined recorded business sales" icon="â‚¹" tone="purple" />
            </div>
            <section className="panel">
              <div className="panel-heading"><div><h2>Business directory</h2><p>Latest registered businesses</p></div></div>
              <div className="table-wrap"><table><thead><tr><th>BUSINESS</th><th>BUSINESS ID</th><th>SALES</th><th>INVOICES</th><th>PRODUCTS</th><th>STOCK QTY</th><th>STOCK VALUE</th><th>PURCHASES</th><th>EXPENSES</th><th>GROSS PROFIT</th><th>NET PROFIT*</th><th>STATUS</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>
                {(platformOverview.businesses || []).map(b => <tr key={b.id}><td><b>{b.name}</b></td><td>{b.id}</td><td>{money(Number(b.total_sales || 0))}</td><td>{Number(b.invoice_count || 0)}</td><td>{Number(b.product_count || 0)}</td><td>{Number(b.stock_quantity || 0)}</td><td>{money(Number(b.stock_value || 0))}</td><td>{money(Number(b.total_purchases || 0))}</td><td>{money(Number(b.total_expenses || 0))}</td><td>{money(Number(b.gross_profit || 0))}</td><td>{money(Number(b.estimated_net_profit || 0))}</td><td><span className={`demo-badge ${b.status === 'suspended' ? 'status-suspended' : ''}`}>{b.status || 'active'}</span></td><td>{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '-'}</td><td><button className="text-button" disabled={Boolean(statusUpdating)} onClick={async () => { const nextStatus = b.status === 'suspended' ? 'active' : 'suspended'; const confirmed = window.confirm(`${nextStatus === 'suspended' ? 'Suspend' : 'Activate'} ${b.name}?`); if (!confirmed) return; setStatusUpdating(b.id); try { const { error } = await supabase.rpc('set_business_status', { p_business_id: b.id, p_status: nextStatus }); if (error) throw error; const { data: refreshed, error: refreshError } = await supabase.rpc('get_platform_overview'); if (refreshError) throw refreshError; setPlatformOverview(refreshed); } catch (err) { window.alert(err.message || 'Could not update business status'); } finally { setStatusUpdating(null); } }}>{statusUpdating === b.id ? 'Updating...' : b.status === 'suspended' ? 'Activate' : 'Suspend'}</button></td></tr>)}
              </tbody></table>{!(platformOverview.businesses || []).length && <div className="empty-small">No businesses registered yet.</div>}</div>
            </section>
          </>}
        </>}
        {page === 'User Management' && isPlatformAdmin && <>
          <PageHeading title="User Management" desc="Registered accounts, verification and business memberships." />
          {platformUsersLoading && <div className="panel">Loading users...</div>}
          {platformUsersError && <div className="notice wide-notice">User directory error: {platformUsersError}</div>}
          {!platformUsersLoading && !platformUsersError && <section className="panel">
            <div className="section-heading"><div><h2>Registered users</h2><p>{platformUsers.length} accounts</p></div></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Email</th><th>Registered</th><th>Email verified</th><th>Business memberships</th><th>Platform admin</th></tr></thead>
              <tbody>
                {platformUsers.map((u) => <tr key={u.user_id}>
                  <td><strong>{u.email || 'No email'}</strong><div className="muted">{u.user_id}</div></td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-Â'}</td>
                  <td>{u.email_confirmed ? 'Verified' : 'Not verified'}</td>
                  <td>{Array.isArray(u.businesses) && u.businesses.length ? u.businesses.map((b) => `${b.business_name} (${b.role})`).join(', ') : 'No business'}</td>
                  <td>{u.is_platform_admin ? 'Yes' : 'No'}</td>
                </tr>)}
                {platformUsers.length === 0 && <tr><td colSpan="5">No registered users found.</td></tr>}
              </tbody>
            </table></div>
          </section>}
        </>}
        {page === 'Overview' && <>
          <div className="page-heading"><div><div className="eyebrow">BUSINESS OVERVIEW</div><h1>Good day, {data.business.owner || 'there'} <span>*</span></h1><p>Here's what's happening with your business today.</p></div><button className="primary-button" onClick={() => setPage('Billing')}>+ Create invoice</button></div>
          <div className="stat-grid">
            <Stat title="Total sales" value={money(totalSales)} note={`${data.sales.length} invoices recorded`} icon="->" tone="green" />
            <Stat title="Purchase value" value={money(totalPurchases)} note={`${data.purchases.length} purchase entries`} icon="I" tone="blue" />
            <Stat title="Stock at cost" value={money(stockValue)} note={`${data.products.length} products`} icon="P" tone="orange" />
            <Stat title="Gross profit*" value={money(grossProfit)} note={`Expenses: ${money(totalExpenses)}`} icon="Rs." tone="purple" />
          </div>
          <div className="overview-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h2>Recent sales</h2><p>Your latest invoices</p></div><button className="text-button" onClick={() => setPage('Reports')}>View reports -&gt;</button></div>{data.sales.length ? <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>DATE</th><th className="right">TOTAL</th></tr></thead><tbody>{data.sales.slice(0,6).map(s => <tr key={s.id}><td><b>{s.invoice}</b></td><td>{s.customerName}</td><td>{new Date(s.date).toLocaleDateString('en-IN')}</td><td className="right amount">{money(s.total)}</td></tr>)}</tbody></table></div> : <Empty icon="B" title="No sales recorded yet" desc="Create your first invoice to see sales activity here." action="Create invoice" onClick={() => setPage('Billing')} />}</section>
          <section className="panel stock-panel"><div className="panel-heading"><div><h2>Stock overview</h2><p>Products that need attention</p></div><button className="text-button" onClick={() => setPage('Products & Stock')}>All stock -&gt;</button></div>{data.products.length ? data.products.slice().sort((a,b)=>a.stock-b.stock).slice(0,5).map(p => <div className="stock-row" key={p.id}><div className="product-symbol">{p.name.slice(0,1).toUpperCase()}</div><div className="stock-info"><b>{p.name}</b><small>{p.sku || 'No SKU'}</small><div className="stock-track"><span style={{width: `${Math.min(100, Math.max(4, p.stock * 3))}%`}}></span></div></div><div className="stock-count"><b>{p.stock}</b><small>units</small>{p.stock <= 5 && <em>Low</em>}</div></div>) : <Empty title="No products" desc="Add products to manage inventory." action="Add product" onClick={() => setPage('Products & Stock')} />}</section></div>
          <div className="quick-grid"><Quick title="Create invoice" desc="Record a sale and update stock" icon="+" onClick={() => setPage('Billing')} /><Quick title="Add a product" desc="Manage items and stock levels" icon="P" onClick={() => setPage('Products & Stock')} /><Quick title="Record purchase" desc="Add incoming inventory" icon="I" onClick={() => setPage('Purchases')} /><Quick title="View reports" desc="Track sales and business totals" icon="R" onClick={() => setPage('Reports')} /></div>
          <p className="footnote">*Gross profit is a simple estimate based on recorded sales and product cost. It excludes taxes, returns, opening stock adjustments and other accounting adjustments.</p>
        </>}
        {page === 'Billing' && <><PageHeading title="Billing & Sales" desc="Create invoices and keep your sales record up to date." /><div className="two-col"><section className="panel form-panel"><h2>Create sales invoice</h2><p className="muted">Stock is reduced when a demo invoice is recorded.</p><form onSubmit={makeSale} className="form-grid"><Field label="Product"><select required value={saleForm.productId} onChange={e => setSaleForm({...saleForm, productId:e.target.value})}><option value="">Select product</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} | Stock {p.stock}</option>)}</select></Field><Field label="Customer"><select value={saleForm.customerId} onChange={e=>setSaleForm({...saleForm,customerId:e.target.value})}>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Quantity"><input type="number" min="1" required value={saleForm.qty} onChange={e=>setSaleForm({...saleForm,qty:e.target.value})}/></Field><div className="invoice-preview"><span>Estimated invoice total (incl. configured tax)</span><b>{money(salePreview)}</b></div><button className="primary-button full" type="submit">Create invoice -&gt;</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Invoice history</h2><p>Most recent first</p></div></div><DataTable headers={['Invoice','Customer','Total']} rows={data.sales.map(s=>[s.invoice,s.customerName,money(s.total)])} empty="No invoices yet." /></section></div></>}
        {page === 'Products & Stock' && <><PageHeading title="Products & Inventory" desc="Manage product details, selling price and available stock." /><div className="two-col inventory-layout"><section className="panel form-panel"><h2>Add product</h2><form onSubmit={addProduct} className="form-grid"><Field label="Product name"><input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Cotton T-shirt"/></Field><Field label="SKU / item code"><input value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="Optional"/></Field><div className="field-row"><Field label="Selling price (Rs.)"><input type="number" min="0" step="0.01" required value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></Field><Field label="Cost price (Rs.)"><input type="number" min="0" step="0.01" required value={productForm.cost} onChange={e=>setProductForm({...productForm,cost:e.target.value})}/></Field></div><div className="field-row"><Field label="Opening stock"><input type="number" min="0" step="1" required value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></Field><Field label="Tax rate (%)"><select value={productForm.tax} onChange={e=>setProductForm({...productForm,tax:e.target.value})}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></Field></div><button className="primary-button full" type="submit">+ Add product</button></form></section><section className="panel"><div className="panel-heading wrap-heading"><div><h2>Product catalogue</h2><p>{data.products.length} products in your workspace</p></div><input className="search-input" placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>PRICE</th><th>STOCK</th></tr></thead><tbody>{filteredProducts.map(p=><tr key={p.id}><td><b>{p.name}</b><small className="table-sub">Cost {money(p.cost)} | Tax {p.tax}%</small></td><td>{p.sku || '-'}</td><td>{money(p.price)}</td><td><span className={`stock-pill ${p.stock<=5?'low':''}`}>{p.stock} units</span></td></tr>)}</tbody></table>{!filteredProducts.length&&<div className="empty-small">No matching products.</div>}</div></section></div></>}
        {page === 'Purchases' && <><PageHeading title="Purchases" desc="Record stock received from suppliers."/><div className="two-col"><section className="panel form-panel"><h2>Record purchase</h2><form onSubmit={makePurchase} className="form-grid"><Field label="Product"><select required value={purchaseForm.productId} onChange={e=>{const p=data.products.find(x=>x.id===Number(e.target.value));setPurchaseForm({...purchaseForm,productId:e.target.value,unitCost:p?String(p.cost):''})}}><option value="">Select product</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><div className="field-row"><Field label="Quantity"><input type="number" min="1" required value={purchaseForm.qty} onChange={e=>setPurchaseForm({...purchaseForm,qty:e.target.value})}/></Field><Field label="Unit cost (Rs.)"><input type="number" min="0" step="0.01" required value={purchaseForm.unitCost} onChange={e=>setPurchaseForm({...purchaseForm,unitCost:e.target.value})}/></Field></div><div className="invoice-preview"><span>Purchase total</span><b>{money((+purchaseForm.qty||0)*(+purchaseForm.unitCost||0))}</b></div><button className="primary-button full">Save purchase</button></form></section><section className="panel"><h2>Purchase history</h2><DataTable headers={['Product','Quantity','Total']} rows={data.purchases.map(p=>[p.productName,p.qty,money(p.total)])} empty="No purchases recorded yet."/></section></div></>}
        {page === 'Customers' && <><PageHeading title="Customers" desc="Keep customer contact details in one place."/><div className="two-col"><section className="panel form-panel"><h2>Add customer</h2><form className="form-grid" onSubmit={addCustomer}><Field label="Customer name"><input required value={customerForm.name} onChange={e=>setCustomerForm({...customerForm,name:e.target.value})}/></Field><Field label="Phone number"><input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/></Field><button className="primary-button full">+ Add customer</button></form></section><section className="panel"><h2>Customer directory</h2><DataTable headers={['Name','Phone']} rows={data.customers.map(c=>[c.name,c.phone||'-'])} empty="No customers added."/></section></div></>}
        {page === 'Expenses' && <><PageHeading title="Expenses" desc="Record operating expenses for a simple business summary."/><div className="two-col"><section className="panel form-panel"><h2>Add expense</h2><form className="form-grid" onSubmit={addExpense}><Field label="Expense name"><input required value={expenseForm.title} onChange={e=>setExpenseForm({...expenseForm,title:e.target.value})} placeholder="e.g. Packaging, Rent"/></Field><Field label="Amount (Rs.)"><input type="number" min="0.01" step="0.01" required value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})}/></Field><button className="primary-button full">Save expense</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Expense history</h2><p>Total recorded: {money(totalExpenses)}</p></div></div><DataTable headers={['Expense','Date','Amount']} rows={data.expenses.map(x=>[x.title,new Date(x.date).toLocaleDateString('en-IN'),money(x.amount)])} empty="No expenses recorded."/></section></div></>}
        {page === 'Reports' && <><PageHeading title="Reports & Insights" desc="A quick view of sales, purchases, stock and recorded expenses."/><div className="stat-grid"><Stat title="Sales" value={money(totalSales)} note={`${data.sales.length} invoices`} icon="->" tone="green"/><Stat title="Purchases" value={money(totalPurchases)} note={`${data.purchases.length} entries`} icon="I" tone="blue"/><Stat title="Expenses" value={money(totalExpenses)} note={`${data.expenses.length} entries`} icon="Rs." tone="orange"/><Stat title="Estimated gross profit" value={money(grossProfit)} note="Before expenses and tax adjustments" icon="Rs." tone="purple"/></div><section className="panel report-panel"><div className="panel-heading"><div><h2>Business summary</h2><p>Totals from entries in this browser demo</p></div><button className="secondary-button" onClick={exportData}>Export JSON backup</button></div><div className="stat-grid">
  <Stat title="Today's sales" value={money(dailySalesTotal)} note={`${dailySales.length} invoices today`} icon="->" tone="green"/>
  <Stat title="This month's sales" value={money(monthlySalesTotal)} note={`${monthlySales.length} invoices this month`} icon="->" tone="blue"/>
  <Stat title="Today's expenses" value={money(dailyExpensesTotal)} note={`${dailyExpenses.length} entries today`} icon="Rs." tone="orange"/>
  <Stat title="This month's expenses" value={money(monthlyExpensesTotal)} note={`${monthlyExpenses.length} entries this month`} icon="Rs." tone="purple"/>
  </div><div className="report-line"><span>Sales before tax</span><b>{money(data.sales.reduce((s,x)=>s+x.subtotal,0))}</b></div><div className="report-line"><span>Configured sales tax total</span><b>{money(data.sales.reduce((s,x)=>s+x.taxAmount,0))}</b></div><div className="report-line"><span>Gross profit estimate</span><b>{money(grossProfit)}</b></div><div className="report-line"><span>Recorded expenses</span><b>{money(totalExpenses)}</b></div><div className="report-line total-line"><span>Estimate after recorded expenses*</span><b>{money(grossProfit-totalExpenses)}</b></div><p className="footnote">*This is not a statutory financial statement. It excludes opening stock adjustments, returns, other costs, and full double-entry accounting.</p></section></>}
        {page === 'Business Settings' && <><PageHeading title="Business settings" desc="Configure the profile shown in your workspace."/><section className="panel settings-panel"><h2>Business profile</h2><form className="form-grid settings-form" onSubmit={saveBusiness}><Field label="Business / company name"><input required value={businessForm.name} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></Field><Field label="Owner name"><input value={businessForm.owner} onChange={e=>setBusinessForm({...businessForm,owner:e.target.value})}/></Field><Field label="GSTIN (optional for demo)"><input value={businessForm.gstin} onChange={e=>setBusinessForm({...businessForm,gstin:e.target.value.toUpperCase()})} maxLength="15" placeholder="15-character GSTIN"/></Field><div className="notice">GSTIN is stored only in this browser demo. GST validation, invoice compliance and secure server storage are not implemented yet.</div><button className="primary-button">Save business profile</button></form></section><section className="panel danger-panel"><div><h2>Demo data</h2><p>Export a backup before resetting your local demo data.</p></div><div className="button-row"><button className="secondary-button" onClick={exportData}>Export backup</button><button className="danger-button" onClick={resetDemo}>Reset demo data</button></div></section></>}
        {page === 'Subscription' && <><PageHeading title="Plans & subscription" desc="Subscription management will be connected after the secure SaaS backend is ready."/><div className="pricing-grid"><Plan name="Starter" price="Free" desc="For testing the workflow" features={['Single demo workspace','Products and stock','Basic sales invoices','Local browser data']} current/><Plan name="Growth" price="Rs.499" period="/month (proposed)" desc="For small businesses" features={['Cloud sync and secure login','Inventory and purchase records','Reports and team access','Priority support']} /><Plan name="Business" price="Rs.999" period="/month (proposed)" desc="For growing teams" features={['Multiple users and locations','Advanced reports','Role-based permissions','Expanded usage limits']} /></div><div className="notice wide-notice">These prices are placeholders, not active offers. No subscription is charged in this starter app. Payment gateway and plan enforcement are not connected.</div></>}
      </div>
    </main>
    {toast && <div className="toast">* &nbsp;{toast}</div>}
  </div>;
}
function Stat({title,value,note,icon,tone}) { return <div className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{note}</small></div>; }
function PageHeading({title,desc}) { return <div className="page-heading inner-heading"><div><div className="eyebrow">WORKSPACE</div><h1>{title}</h1><p>{desc}</p></div></div>; }
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Empty({icon='B',title,desc,action,onClick}) { return <div className="empty-state"><div className="empty-icon">{icon}</div><b>{title}</b><p>{desc}</p>{action&&<button className="secondary-button" onClick={onClick}>{action}</button>}</div>; }
function Quick({title,desc,icon,onClick}) { return <button className="quick-card" onClick={onClick}><span className="quick-icon">{icon}</span><span className="quick-copy"><b>{title}</b><small>{desc}</small></span><span className="quick-arrow">-&gt;</span></button>; }
function DataTable({headers,rows,empty}) { return rows.length ? <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div> : <div className="empty-small">{empty}</div>; }

createRoot(document.getElementById('root')).render(<AuthGate><App /></AuthGate>);
