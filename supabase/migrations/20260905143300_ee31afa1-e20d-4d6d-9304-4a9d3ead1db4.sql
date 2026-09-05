-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Auto-create profile + role on signup: first user = admin, others = employee
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_exists boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''));
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN admin_exists THEN 'employee'::public.app_role ELSE 'admin'::public.app_role END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "roles_admin_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "roles_admin_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- ===== Employees & attendance =====
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  position text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT 'Production',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "employees_admin_write" ON public.employees FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in time NOT NULL,
  clock_out time,
  hours numeric GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL THEN ROUND((EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600)::numeric, 2) END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.my_employee_id());
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.my_employee_id());
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE TO authenticated
  USING (public.is_admin() OR employee_id = public.my_employee_id())
  WITH CHECK (public.is_admin() OR employee_id = public.my_employee_id());
CREATE POLICY "attendance_admin_delete" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin());

-- ===== Clients & invoices =====
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_admin" ON public.clients FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Câbles',
  description text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 10,
  unit text NOT NULL DEFAULT 'm',
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_admin" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entree', 'sortie')),
  quantity integer NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_admin" ON public.stock_movements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.movement_type = 'entree' THEN
    UPDATE public.products SET quantity = quantity + NEW.quantity WHERE id = NEW.product_id;
  ELSE
    UPDATE public.products SET quantity = GREATEST(0, quantity - NEW.quantity) WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE + 30,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('paye', 'en_attente', 'en_retard')),
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_admin" ON public.invoices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items_admin" ON public.invoice_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ===== Suppliers =====
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Matières premières',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_admin" ON public.suppliers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  unit_price numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;
GRANT ALL ON public.supplier_products TO service_role;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_products_admin" ON public.supplier_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('livree', 'en_cours', 'annulee'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_orders TO authenticated;
GRANT ALL ON public.supplier_orders TO service_role;
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_orders_admin" ON public.supplier_orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ===== Energy =====
CREATE TABLE public.energy_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  energy_type text NOT NULL DEFAULT 'Électricité',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kWh',
  unit_cost numeric NOT NULL DEFAULT 0,
  cost numeric GENERATED ALWAYS AS (ROUND((quantity * unit_cost)::numeric, 2)) STORED,
  machine text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.energy_records TO authenticated;
GRANT ALL ON public.energy_records TO service_role;
ALTER TABLE public.energy_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "energy_admin" ON public.energy_records FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ===== Activity log =====
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_admin" ON public.activity_log FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ===== Demo data =====
INSERT INTO public.employees (id, first_name, last_name, position, department, email, phone, hire_date) VALUES
('a0000000-0000-0000-0000-000000000001','Karim','Ben Salah','Chef de production','Production','k.bensalah@polycable.fr','06 12 45 78 90','2019-03-11'),
('a0000000-0000-0000-0000-000000000002','Sonia','Marchand','Opératrice extrusion','Production','s.marchand@polycable.fr','06 22 13 87 41','2021-06-01'),
('a0000000-0000-0000-0000-000000000003','Yacine','Trabelsi','Technicien maintenance','Maintenance','y.trabelsi@polycable.fr','06 78 91 20 33','2020-01-20'),
('a0000000-0000-0000-0000-000000000004','Claire','Dubois','Responsable qualité','Qualité','c.dubois@polycable.fr','06 41 55 62 18','2018-09-03'),
('a0000000-0000-0000-0000-000000000005','Mehdi','Haddad','Opérateur tréfilage','Production','m.haddad@polycable.fr','06 90 32 14 77','2022-02-14'),
('a0000000-0000-0000-0000-000000000006','Léa','Fontaine','Assistante logistique','Logistique','l.fontaine@polycable.fr','06 15 88 09 52','2023-04-17'),
('a0000000-0000-0000-0000-000000000007','Omar','Khelifi','Cariste','Logistique','o.khelifi@polycable.fr','06 63 27 44 10','2021-11-08'),
('a0000000-0000-0000-0000-000000000008','Nadia','Roux','Opératrice tri plastique','Recyclage','n.roux@polycable.fr','06 34 71 25 96','2022-08-22');

INSERT INTO public.attendance (employee_id, work_date, clock_in, clock_out)
SELECT e.id, d::date,
  (time '07:30' + (floor(random()*30)::int || ' minutes')::interval),
  (time '16:00' + (floor(random()*90)::int || ' minutes')::interval)
FROM public.employees e
CROSS JOIN generate_series(CURRENT_DATE - 34, CURRENT_DATE - 1, interval '1 day') d
WHERE extract(isodow from d) < 6 AND random() > 0.08;

INSERT INTO public.attendance (employee_id, work_date, clock_in, clock_out) VALUES
('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '07:32', NULL),
('a0000000-0000-0000-0000-000000000002', CURRENT_DATE, '07:45', NULL),
('a0000000-0000-0000-0000-000000000003', CURRENT_DATE, '08:02', NULL),
('a0000000-0000-0000-0000-000000000005', CURRENT_DATE, '07:50', NULL),
('a0000000-0000-0000-0000-000000000007', CURRENT_DATE, '07:58', NULL),
('a0000000-0000-0000-0000-000000000008', CURRENT_DATE, '07:40', NULL);

INSERT INTO public.clients (id, company, contact_name, email, phone, address, city, created_at) VALUES
('b0000000-0000-0000-0000-000000000001','Nexans Distribution','Julien Perret','j.perret@nexans-dist.fr','01 45 22 87 90','12 rue de l''Industrie','Lyon', now() - interval '410 days'),
('b0000000-0000-0000-0000-000000000002','ElecPro Sud','Amina Belkacem','a.belkacem@elecpro.fr','04 91 30 12 45','ZI Les Paluds','Marseille', now() - interval '300 days'),
('b0000000-0000-0000-0000-000000000003','Bâti-Réseaux SA','Thomas Girard','t.girard@batireseaux.com','02 40 18 76 33','8 avenue des Chantiers','Nantes', now() - interval '210 days'),
('b0000000-0000-0000-0000-000000000004','Solartech Énergie','Inès Moreau','i.moreau@solartech.fr','05 61 44 90 12','Parc technologique','Toulouse', now() - interval '95 days'),
('b0000000-0000-0000-0000-000000000005','Métro Câblage Île-de-France','Paul Lambert','p.lambert@metrocablage.fr','01 39 71 25 60','44 bd Voltaire','Paris', now() - interval '40 days'),
('b0000000-0000-0000-0000-000000000006','GreenWire Recycling','Sofia Costa','s.costa@greenwire.eu','03 88 12 45 78','Rue du Rhin','Strasbourg', now() - interval '12 days');

INSERT INTO public.products (id, name, category, description, quantity, min_stock, unit, price, created_at) VALUES
('c0000000-0000-0000-0000-000000000001','Câble H07V-U 1,5 mm² rouge','Câbles rigides','Conducteur cuivre, isolant PVC recyclé. Bobine 100 m.',1250,300,'m',0.42, now() - interval '400 days'),
('c0000000-0000-0000-0000-000000000002','Câble H07V-U 2,5 mm² bleu','Câbles rigides','Conducteur cuivre, isolant PVC recyclé. Bobine 100 m.',180,300,'m',0.68, now() - interval '400 days'),
('c0000000-0000-0000-0000-000000000003','Câble R2V 3G2,5','Câbles souples','Câble industriel gaine PE recyclé, 3 conducteurs.',3400,500,'m',1.35, now() - interval '350 days'),
('c0000000-0000-0000-0000-000000000004','Câble R2V 5G6','Câbles souples','Câble de puissance gaine noire, 5 conducteurs.',0,200,'m',4.20, now() - interval '350 days'),
('c0000000-0000-0000-0000-000000000005','Câble solaire 6 mm² noir','Câbles spéciaux','Résistant UV, gaine XLPE issue de plastique recyclé.',920,250,'m',1.85, now() - interval '200 days'),
('c0000000-0000-0000-0000-000000000006','Câble réseau Cat6 U/UTP','Câbles data','Gaine LSZH recyclée, touret 305 m.',45,60,'m',0.38, now() - interval '180 days'),
('c0000000-0000-0000-0000-000000000007','Granulés PVC recyclé (gris)','Matière première','Granulés issus du broyage de déchets plastiques triés.',7800,2000,'kg',0.95, now() - interval '500 days'),
('c0000000-0000-0000-0000-000000000008','Granulés PE recyclé (noir)','Matière première','Polyéthylène recyclé pour gainage.',1500,2000,'kg',1.10, now() - interval '500 days'),
('c0000000-0000-0000-0000-000000000009','Gaine ICTA Ø20 mm','Gaines','Gaine annelée en plastique recyclé, couronne 100 m.',600,150,'m',0.29, now() - interval '120 days'),
('c0000000-0000-0000-0000-000000000010','Câble U-1000 AR2V 4x16','Câbles souples','Câble armé de puissance, gaine PE recyclée.',0,50,'m',12.40, now() - interval '90 days');

INSERT INTO public.stock_movements (product_id, movement_type, quantity, note, created_at) VALUES
('c0000000-0000-0000-0000-000000000001','entree',500,'Production lot L-2409', now() - interval '6 days'),
('c0000000-0000-0000-0000-000000000003','sortie',800,'Livraison Nexans Distribution', now() - interval '5 days'),
('c0000000-0000-0000-0000-000000000007','entree',2000,'Réception GreenPlast', now() - interval '4 days'),
('c0000000-0000-0000-0000-000000000002','sortie',320,'Livraison ElecPro Sud', now() - interval '3 days'),
('c0000000-0000-0000-0000-000000000004','sortie',200,'Livraison Bâti-Réseaux', now() - interval '2 days'),
('c0000000-0000-0000-0000-000000000005','entree',400,'Production lot L-2412', now() - interval '1 days'),
('c0000000-0000-0000-0000-000000000006','sortie',260,'Livraison Métro Câblage', now() - interval '12 hours');
-- reset quantities after trigger-applied demo movements
UPDATE public.products SET quantity = 1250 WHERE id='c0000000-0000-0000-0000-000000000001';
UPDATE public.products SET quantity = 180 WHERE id='c0000000-0000-0000-0000-000000000002';
UPDATE public.products SET quantity = 3400 WHERE id='c0000000-0000-0000-0000-000000000003';
UPDATE public.products SET quantity = 0 WHERE id='c0000000-0000-0000-0000-000000000004';
UPDATE public.products SET quantity = 920 WHERE id='c0000000-0000-0000-0000-000000000005';
UPDATE public.products SET quantity = 45 WHERE id='c0000000-0000-0000-0000-000000000006';
UPDATE public.products SET quantity = 7800 WHERE id='c0000000-0000-0000-0000-000000000007';

INSERT INTO public.invoices (id, invoice_number, client_id, issue_date, due_date, status, total) VALUES
('d0000000-0000-0000-0000-000000000001','FAC-2025-0101','b0000000-0000-0000-0000-000000000001', CURRENT_DATE - 75, CURRENT_DATE - 45,'paye',4860.00),
('d0000000-0000-0000-0000-000000000002','FAC-2025-0102','b0000000-0000-0000-0000-000000000002', CURRENT_DATE - 60, CURRENT_DATE - 30,'paye',2176.00),
('d0000000-0000-0000-0000-000000000003','FAC-2025-0103','b0000000-0000-0000-0000-000000000003', CURRENT_DATE - 50, CURRENT_DATE - 20,'en_retard',8400.00),
('d0000000-0000-0000-0000-000000000004','FAC-2025-0104','b0000000-0000-0000-0000-000000000001', CURRENT_DATE - 30, CURRENT_DATE,'en_attente',1080.00),
('d0000000-0000-0000-0000-000000000005','FAC-2025-0105','b0000000-0000-0000-0000-000000000004', CURRENT_DATE - 25, CURRENT_DATE + 5,'en_attente',3700.00),
('d0000000-0000-0000-0000-000000000006','FAC-2025-0106','b0000000-0000-0000-0000-000000000005', CURRENT_DATE - 12, CURRENT_DATE + 18,'en_attente',1140.00),
('d0000000-0000-0000-0000-000000000007','FAC-2025-0107','b0000000-0000-0000-0000-000000000002', CURRENT_DATE - 8, CURRENT_DATE + 22,'paye',1350.00),
('d0000000-0000-0000-0000-000000000008','FAC-2025-0108','b0000000-0000-0000-0000-000000000006', CURRENT_DATE - 3, CURRENT_DATE + 27,'en_attente',2850.00);

INSERT INTO public.invoice_items (invoice_id, product_id, description, quantity, unit_price) VALUES
('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','Câble R2V 3G2,5',3600,1.35),
('d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','Câble H07V-U 2,5 mm² bleu',3200,0.68),
('d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004','Câble R2V 5G6',2000,4.20),
('d0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003','Câble R2V 3G2,5',800,1.35),
('d0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000005','Câble solaire 6 mm² noir',2000,1.85),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000006','Câble réseau Cat6 U/UTP',3000,0.38),
('d0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001','Câble H07V-U 1,5 mm² rouge',2500,0.42),
('d0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000009','Gaine ICTA Ø20 mm',1000,0.29),
('d0000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000007','Granulés PVC recyclé (gris)',3000,0.95);

INSERT INTO public.suppliers (id, name, contact_name, email, phone, address, city, category, created_at) VALUES
('e0000000-0000-0000-0000-000000000001','GreenPlast Recyclage','Hugo Martin','h.martin@greenplast.fr','03 20 45 67 89','Rue des Écopôles','Lille','Déchets plastiques', now() - interval '600 days'),
('e0000000-0000-0000-0000-000000000002','CuivreTech Industries','Sarah Nguyen','s.nguyen@cuivretech.com','04 72 11 22 33','ZA des Métaux','Saint-Étienne','Métaux', now() - interval '540 days'),
('e0000000-0000-0000-0000-000000000003','Additifs Polymères SAS','Marc Lefèvre','m.lefevre@additifspoly.fr','02 35 88 12 09','Port industriel','Le Havre','Additifs chimiques', now() - interval '380 days'),
('e0000000-0000-0000-0000-000000000004','Extrusion Machines Europe','Anna Schmidt','a.schmidt@eme-machines.eu','+49 711 55 66 77','Industriestraße 4','Stuttgart','Équipements', now() - interval '250 days'),
('e0000000-0000-0000-0000-000000000005','EnerGaz Pro','Lucas Bernard','l.bernard@energazpro.fr','01 70 33 21 45','15 rue de Rome','Paris','Énergie', now() - interval '120 days');

INSERT INTO public.supplier_products (supplier_id, product_name, unit, unit_price) VALUES
('e0000000-0000-0000-0000-000000000001','Déchets PVC triés','kg',0.32),
('e0000000-0000-0000-0000-000000000001','Déchets PE triés','kg',0.28),
('e0000000-0000-0000-0000-000000000001','Broyat mixte','kg',0.18),
('e0000000-0000-0000-0000-000000000002','Fil machine cuivre 8 mm','kg',8.90),
('e0000000-0000-0000-0000-000000000002','Fil aluminium 9,5 mm','kg',3.40),
('e0000000-0000-0000-0000-000000000003','Stabilisant thermique Ca/Zn','kg',4.10),
('e0000000-0000-0000-0000-000000000003','Plastifiant DINP','kg',2.35),
('e0000000-0000-0000-0000-000000000003','Pigment noir de carbone','kg',1.90),
('e0000000-0000-0000-0000-000000000004','Vis d''extrusion Ø90','pièce',6200.00),
('e0000000-0000-0000-0000-000000000004','Filière de gainage','pièce',1450.00),
('e0000000-0000-0000-0000-000000000005','Gaz naturel industriel','MWh',68.00);

INSERT INTO public.supplier_orders (supplier_id, order_number, order_date, description, amount, status) VALUES
('e0000000-0000-0000-0000-000000000001','CMD-2025-041', CURRENT_DATE - 40,'12 t déchets PVC triés',3840.00,'livree'),
('e0000000-0000-0000-0000-000000000001','CMD-2025-052', CURRENT_DATE - 4,'8 t déchets PE triés',2240.00,'en_cours'),
('e0000000-0000-0000-0000-000000000002','CMD-2025-044', CURRENT_DATE - 32,'2,5 t fil machine cuivre',22250.00,'livree'),
('e0000000-0000-0000-0000-000000000002','CMD-2025-053', CURRENT_DATE - 2,'1 t fil aluminium',3400.00,'en_cours'),
('e0000000-0000-0000-0000-000000000003','CMD-2025-046', CURRENT_DATE - 25,'Stabilisant + plastifiant',1935.00,'livree'),
('e0000000-0000-0000-0000-000000000004','CMD-2025-039', CURRENT_DATE - 55,'Filière de gainage de rechange',1450.00,'livree'),
('e0000000-0000-0000-0000-000000000004','CMD-2025-050', CURRENT_DATE - 10,'Vis d''extrusion Ø90',6200.00,'annulee'),
('e0000000-0000-0000-0000-000000000005','CMD-2025-048', CURRENT_DATE - 18,'Gaz naturel – contrat mensuel',4080.00,'livree');

INSERT INTO public.energy_records (record_date, energy_type, quantity, unit, unit_cost, machine)
SELECT d::date, 'Électricité',
  ROUND((CASE WHEN extract(isodow from d) < 6 THEN 1800 + random()*700 ELSE 350 + random()*150 END)::numeric, 1),
  'kWh', 0.19, m
FROM generate_series(CURRENT_DATE - 364, CURRENT_DATE, interval '1 day') d
CROSS JOIN unnest(ARRAY['Extrudeuse EX-1','Extrudeuse EX-2','Broyeur BR-1']) m;

INSERT INTO public.energy_records (record_date, energy_type, quantity, unit, unit_cost, machine)
SELECT d::date, 'Gaz naturel',
  ROUND((CASE WHEN extract(isodow from d) < 6 THEN 4.2 + random()*1.5 ELSE 1.0 + random()*0.5 END)::numeric, 2),
  'MWh', 68.00, 'Four de séchage FS-1'
FROM generate_series(CURRENT_DATE - 364, CURRENT_DATE, interval '1 day') d;

INSERT INTO public.energy_records (record_date, energy_type, quantity, unit, unit_cost, machine)
SELECT d::date, 'Eau', ROUND((12 + random()*6)::numeric, 1), 'm³', 3.80, 'Circuit de refroidissement'
FROM generate_series(CURRENT_DATE - 364, CURRENT_DATE, interval '1 day') d
WHERE extract(isodow from d) < 6;

INSERT INTO public.activity_log (kind, message, created_at) VALUES
('facture','Facture FAC-2025-0108 émise pour GreenWire Recycling (2 850 €)', now() - interval '3 hours'),
('stock','Sortie de stock : 260 m de Câble réseau Cat6 U/UTP', now() - interval '12 hours'),
('employe','Nadia Roux a pointé son entrée à 07:40', now() - interval '7 hours'),
('energie','Consommation du jour enregistrée pour Extrudeuse EX-1', now() - interval '1 day'),
('client','Nouveau client : GreenWire Recycling', now() - interval '12 days'),
('fournisseur','Commande CMD-2025-053 passée chez CuivreTech Industries', now() - interval '2 days'),
('alerte','Rupture de stock : Câble R2V 5G6', now() - interval '2 days'),
('paiement','Paiement reçu : FAC-2025-0107 (ElecPro Sud)', now() - interval '4 days');