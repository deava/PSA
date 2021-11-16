import unittest
from kassapaate import Kassapaate
from maksukortti import Maksukortti

class TestKassapaate(unittest.TestCase):

    def assert_kassapaate(self, rahaa, e, m):
        self.assertEqual(self.kassapaate.kassassa_rahaa, rahaa)
        self.assertEqual(self.kassapaate.edulliset, e)
        self.assertEqual(self.kassapaate.maukkaat, m)

    def setUp(self):
        self.kassapaate = Kassapaate()

    def test_paate_luotu_oikein(self):
        self.assert_kassapaate(100000, 0, 0)

    def test_edullisen_kateisosto(self):
        vaihtoraha = self.kassapaate.syo_edullisesti_kateisella(1000)
        self.assertEqual(vaihtoraha, 760)
        self.assert_kassapaate(100240, 1, 0)

    def test_maukkaan_kateisosto(self):
        vaihtoraha = self.kassapaate.syo_maukkaasti_kateisella(1000)
        self.assertEqual(vaihtoraha, 600)
        self.assert_kassapaate(100400, 0, 1)

    def test_edullisen_kateisosto_ei_riita(self):
        vaihtoraha = self.kassapaate.syo_edullisesti_kateisella(230)
        self.assertEqual(vaihtoraha, 230)
        self.assert_kassapaate(100000, 0, 0)

    def test_maukkaan_kateisosto_ei_riita(self):
        vaihtoraha = self.kassapaate.syo_maukkaasti_kateisella(390)
        self.assertEqual(vaihtoraha, 390)
        self.assert_kassapaate(100000, 0, 0)

    def test_maukkaan_korttiosto_onnistuu(self):
        maksukortti = Maksukortti(1000)
        self.assertEqual(self.kassapaate.syo_maukkaasti_kortilla(maksukortti), True)
        self.assert_kassapaate(100000, 0, 1)

    def test_edullisen_korttiosto_onnistuu(self):
        maksukortti = Maksukortti(1000)
        self.assertEqual(self.kassapaate.syo_edullisesti_kortilla(maksukortti), True)
        self.assert_kassapaate(100000, 1, 0)
    
    def test_maukkaan_korttiosto_epaonnistuu(self):
        maksukortti = Maksukortti(300)
        self.assertEqual(self.kassapaate.syo_maukkaasti_kortilla(maksukortti), False)
        self.assert_kassapaate(100000, 0, 0)

    def test_edullisen_korttiosto_epaonnistuu(self):
        maksukortti = Maksukortti(200)
        self.assertEqual(self.kassapaate.syo_edullisesti_kortilla(maksukortti), False)
        self.assert_kassapaate(100000, 0, 0)
    
    def test_lataa_rahaa_kortille_toimii(self):
        maksukortti = Maksukortti(0)
        self.kassapaate.lataa_rahaa_kortille(maksukortti,1)
        self.assertEqual(maksukortti.saldo,1)
        self.assert_kassapaate(100001,0,0)

    def test_lataa_rahaa_kortille_eineg(self):
        maksukortti = Maksukortti(0)
        self.kassapaate.lataa_rahaa_kortille(maksukortti,-1)
        self.assertEqual(maksukortti.saldo,0)
        self.assert_kassapaate(100000,0,0)