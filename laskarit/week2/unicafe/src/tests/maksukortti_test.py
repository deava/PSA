import unittest
from maksukortti import Maksukortti

class TestMaksukortti(unittest.TestCase):

    def setUp(self):
        self.maksukortti = Maksukortti(10)

    def test_luotu_kortti_on_olemassa(self):
        self.assertNotEqual(self.maksukortti, None)

    def test_saldo_oikein(self):
        self.assertEqual(self.maksukortti.saldo, 10)

    def test_saldo_ottaminen_toimii(self):
        self.maksukortti.ota_rahaa(2)
        self.assertEqual(self.maksukortti.saldo,8)
    
    def test_saldo_ottaminen_ei_liikaa(self):
        self.maksukortti.ota_rahaa(11)
        self.assertEqual(self.maksukortti.saldo,10)
    
    def test_metodi_palauttaa_oikein_riittaa(self):
        self.assertEqual(self.maksukortti.ota_rahaa(2),True)
    
    def test_metodi_palauttaa_oikein_ei_riita(self):
        self.assertEqual(self.maksukortti.ota_rahaa(11),False)

    def test_lataa_rahaa_toimii(self):
        self.maksukortti.lataa_rahaa(2)
        self.assertEqual(self.maksukortti.saldo,12)

    def test_string(self):
        self.assertEqual(str(self.maksukortti),"saldo: 0.1")